import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllBrands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { brandKitchens: true },
        },
      },
    });
  }

  async getBrandBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        brandKitchens: {
          include: {
            menuItems: {
              where: { isAvailable: true },
            },
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug '${slug}' not found`);
    }

    return brand;
  }

  /**
   * Collapse the per-kitchen copies of a menu item into one storefront row.
   *
   * A brand that serves two hubs has two MenuItem rows. The customer should
   * see one card, advertised only at hubs where a copy is actually live.
   */
  private collapseMenuRows(rows: any[]) {
    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const key = row.menuItemGroupId || row.id;
      const group = groups.get(key) || [];
      group.push(row);
      groups.set(key, group);
    }

    const result: any[] = [];
    for (const group of groups.values()) {
      group.sort((a, b) =>
        String(a.brandKitchen?.hubId || '').localeCompare(
          String(b.brandKitchen?.hubId || ''),
        ),
      );

      const live = group.filter((row) => row.isAvailable);
      if (live.length === 0) continue; // 86'd at every hub

      const representative = live[0];
      const liveHubIds = new Set(
        live.map((row) => row.brandKitchen?.hubId).filter(Boolean),
      );
      const brand = representative.brandKitchen?.brand;

      result.push({
        ...representative,
        brandKitchen: {
          ...representative.brandKitchen,
          brand: brand
            ? {
                ...brand,
                // availableHubIds is derived from this list on the storefront.
                brandKitchens: (brand.brandKitchens || []).filter((kitchen: any) =>
                  liveHubIds.has(kitchen.hubId),
                ),
              }
            : brand,
        },
      });
    }

    return result;
  }

  async getMenuItems(brandSlug?: string, category?: string) {
    const rows = await this.prisma.menuItem.findMany({
      where: {
        ...(brandSlug
          ? { brandKitchen: { brand: { slug: brandSlug } } }
          : {}),
        ...(category ? { category: { contains: category, mode: 'insensitive' } } : {}),
      },
      include: {
        brandKitchen: {
          include: {
            brand: {
              include: {
                // Include ALL kitchens of the same brand so the frontend
                // can derive availableHubIds[] (all hubs this brand serves)
                brandKitchens: {
                  where: { isOpen: true },
                  select: { hubId: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return this.collapseMenuRows(rows);
  }

  async searchItems(query: string) {
    if (!query || query.trim().length === 0) return [];

    const rows = await this.prisma.menuItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { brandKitchen: { brand: { name: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      include: {
        brandKitchen: {
          include: {
            brand: {
              include: {
                brandKitchens: {
                  where: { isOpen: true },
                  select: { hubId: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return this.collapseMenuRows(rows);
  }

  async toggle86Item(
    itemId: string,
    isAvailable: boolean,
    actor?: {
      role?: string;
      scopedBrandId?: string | null;
      scopedHubId?: string | null;
    },
  ) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { brandKitchen: { select: { id: true, brandId: true, hubId: true } } },
    });

    if (!item) {
      throw new NotFoundException(`Menu item ${itemId} not found`);
    }

    // A brand operator may only 86 their own brand's items. The route has no
    // brand id for the guard to scope on, so the check has to happen here.
    if (
      actor?.role === 'BRAND_OPS' &&
      actor.scopedBrandId &&
      actor.scopedBrandId !== item.brandKitchen.brandId
    ) {
      throw new ForbiddenException('You can only manage menu items for your own brand');
    }

    // A hub operator may only 86 the copy that belongs to their own hub. The
    // brand must actually serve that hub; otherwise the item does not exist
    // on their menu at all.
    if (actor?.role === 'HUB_STAFF' || actor?.role === 'HUB_MANAGER') {
      const kitchen = actor.scopedHubId
        ? await this.prisma.brandKitchen.findUnique({
            where: {
              brandId_hubId: {
                brandId: item.brandKitchen.brandId,
                hubId: actor.scopedHubId,
              },
            },
          })
        : null;

      if (!kitchen) {
        throw new ForbiddenException('You can only manage menu items for your own hub');
      }

      const hubCopy = item.menuItemGroupId
        ? await this.prisma.menuItem.findFirst({
            where: {
              menuItemGroupId: item.menuItemGroupId,
              brandKitchenId: kitchen.id,
            },
          })
        : kitchen.id === item.brandKitchenId
          ? item
          : null;

      if (!hubCopy) {
        throw new NotFoundException('This item has no menu row for your hub');
      }

      return this.prisma.menuItem.update({
        where: { id: hubCopy.id },
        data: { isAvailable },
      });
    }

    // Brand ops and platform admins toggle the whole logical item.
    if (actor?.role === 'BRAND_OPS' && item.menuItemGroupId) {
      await this.prisma.menuItem.updateMany({
        where: { menuItemGroupId: item.menuItemGroupId },
        data: { isAvailable },
      });
      return { ...item, isAvailable };
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
    });
  }

  // Geohash TTL Cache Store (~350m precision grid, 5-minute TTL)
  private serviceabilityCache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * Ray-Casting Point-in-Polygon Algorithm (SDD §7.2 & Task 12)
   * Tests if coordinates [lng, lat] lie strictly inside a GeoJSON Polygon ring.
   */
  private isPointInPolygon(point: [number, number], polygonCoords: number[][][]): boolean {
    const x = point[0]; // lng
    const y = point[1]; // lat
    let inside = false;

    const ring = polygonCoords[0] || polygonCoords;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Resolves Serviceability & Hub Discovery (SDD §7.2)
   * Uses Ray-Casting Point-in-Polygon matching with 5-minute geohash caching.
   */
  async resolveHubByCoords(lat: number, lng: number) {
    const cacheKey = `geo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    const cached = this.serviceabilityCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const hubs = await this.prisma.hub.findMany({
      include: {
        brandKitchens: {
          where: { isOpen: true },
          include: {
            brand: true,
          },
        },
      },
    });

    if (!hubs || hubs.length === 0) {
      return {
        isServiceable: false,
        hubId: null,
        message: 'Eatclub Cloud Kitchen is not operating in this area yet.',
      };
    }

    // Point-in-Polygon Check using Ray-Casting
    let matchedHub = hubs.find((h) => {
      if (!h.servicePolygon) return false;
      try {
        const polyObj: any = typeof h.servicePolygon === 'string' ? JSON.parse(h.servicePolygon) : h.servicePolygon;
        const coords = polyObj.coordinates || polyObj;
        if (!coords || !Array.isArray(coords)) return false;
        return this.isPointInPolygon([lng, lat], coords);
      } catch (_) {
        return false;
      }
    });

    // Fallback: If customer is within 8km radius of hub center (approx 0.08 deg), match nearest hub
    if (!matchedHub) {
      let minDistance = Number.MAX_VALUE;
      for (const hub of hubs) {
        const dist = Math.sqrt(Math.pow(hub.lat - lat, 2) + Math.pow(hub.lng - lng, 2));
        if (dist < 0.08 && dist < minDistance) {
          minDistance = dist;
          matchedHub = hub;
        }
      }
    }

    if (!matchedHub) {
      const unserviceableResult = {
        isServiceable: false,
        hubId: null,
        message: 'Eatclub Cloud Kitchen is not operating in this area yet.',
      };
      this.serviceabilityCache.set(cacheKey, { data: unserviceableResult, expiresAt: Date.now() + 300000 });
      return unserviceableResult;
    }

    const serviceableBrands = matchedHub.brandKitchens.map((bk) => bk.brand.slug);

    const result = {
      isServiceable: true,
      hubId: matchedHub.id,
      hubName: matchedHub.name,
      city: matchedHub.city,
      lat: matchedHub.lat,
      lng: matchedHub.lng,
      serviceableBrands,
      estimatedDeliveryMins: 22,
    };

    // Cache for 5 minutes (300,000 ms)
    this.serviceabilityCache.set(cacheKey, { data: result, expiresAt: Date.now() + 300000 });
    return result;
  }
}
