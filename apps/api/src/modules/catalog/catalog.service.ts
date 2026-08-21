import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getMenuItems(brandSlug?: string, category?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
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
    });
  }

  async searchItems(query: string) {
    if (!query || query.trim().length === 0) return [];

    return this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
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
    });
  }

  async toggle86Item(itemId: string, isAvailable: boolean) {
    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
    });
  }

  async resolveHubByCoords(lat: number, lng: number) {
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
      throw new NotFoundException('No cloud kitchen hubs available');
    }

    // Euclidean distance calculation for local Hub resolution
    let nearestHub = hubs[0];
    let minDistance = Number.MAX_VALUE;

    for (const hub of hubs) {
      const dist = Math.sqrt(Math.pow(hub.lat - lat, 2) + Math.pow(hub.lng - lng, 2));
      if (dist < minDistance) {
        minDistance = dist;
        nearestHub = hub;
      }
    }

    const serviceableBrands = nearestHub.brandKitchens.map((bk) => bk.brand.slug);

    return {
      hubId: nearestHub.id,
      hubName: nearestHub.name,
      city: nearestHub.city,
      lat: nearestHub.lat,
      lng: nearestHub.lng,
      serviceableBrands,
      estimatedDeliveryMins: 22,
    };
  }
}
