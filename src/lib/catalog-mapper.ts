import type { Brand, CustomizationGroup, MenuItem } from '../types';

/**
 * Maps API catalogue rows to storefront types without inventing anything.
 *
 * The API is the only source of names, prices, images, availability, and
 * merchandising flags. Fields that do not exist in the database (ratings,
 * review counts, delivery estimates) stay absent so the UI can hide them.
 */

export interface ApiBrandKitchenRef {
  hubId?: string | null;
  hub?: { name?: string | null } | null;
}

export interface ApiBrand {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  cuisine?: string[] | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  themeColor?: string | null;
  isActive?: boolean;
  isOwned?: boolean;
  commissionPct?: number | null;
  minOrderValue?: number | null;
  brandKitchens?: ApiBrandKitchenRef[] | null;
  _count?: { brandKitchens?: number } | null;
}

export interface ApiVariant {
  name: string;
  priceInPaise: number;
}

export interface ApiMenuItem {
  id: string;
  menuItemGroupId?: string | null;
  name: string;
  description?: string | null;
  mrpInPaise: number;
  memberPriceInPaise: number;
  imageUrl?: string | null;
  isVeg?: boolean;
  isBestseller?: boolean;
  isAvailable?: boolean;
  category?: string | null;
  dietType?: string | null;
  spiceLevel?: number | null;
  gstPct?: number | null;
  variants?: ApiVariant[] | null;
  addOns?: ApiVariant[] | null;
  brandKitchen?: {
    hubId?: string | null;
    brand?: ApiBrand | null;
  } | null;
}

function paiseToRupees(value: number | null | undefined): number {
  const paise = Number(value);
  return Number.isFinite(paise) ? Math.round(paise) / 100 : 0;
}

function optionGroups(item: ApiMenuItem): CustomizationGroup[] | undefined {
  const groups: CustomizationGroup[] = [];

  if (Array.isArray(item.variants) && item.variants.length > 0) {
    groups.push({
      id: 'variant',
      title: 'Choose a size',
      required: true,
      maxSelection: 1,
      options: item.variants.map((variant, index) => ({
        id: `variant-${index}`,
        name: variant.name,
        price: paiseToRupees(variant.priceInPaise),
        isVeg: item.isVeg !== false,
      })),
    });
  }

  if (Array.isArray(item.addOns) && item.addOns.length > 0) {
    groups.push({
      id: 'addons',
      title: 'Add extras',
      required: false,
      options: item.addOns.map((addOn, index) => ({
        id: `addon-${index}`,
        name: addOn.name,
        price: paiseToRupees(addOn.priceInPaise),
        isVeg: item.isVeg !== false,
      })),
    });
  }

  return groups.length > 0 ? groups : undefined;
}

function liveHubs(item: ApiMenuItem): { ids: string[]; names: Record<string, string> } {
  const kitchens = item.brandKitchen?.brand?.brandKitchens;
  if (!Array.isArray(kitchens)) return { ids: [], names: {} };

  const ids: string[] = [];
  const names: Record<string, string> = {};
  for (const kitchen of kitchens) {
    const hubId = kitchen?.hubId;
    if (typeof hubId !== 'string' || hubId.length === 0) continue;
    if (!ids.includes(hubId)) ids.push(hubId);
    const name = kitchen?.hub?.name;
    if (typeof name === 'string' && name.length > 0 && !names[hubId]) {
      names[hubId] = name;
    }
  }

  return { ids, names };
}

export function mapApiBrand(raw: ApiBrand): Brand {
  return {
    id: raw.slug || raw.id,
    name: raw.name,
    tagline: raw.tagline || '',
    logo: raw.logoUrl || '',
    heroImage: raw.heroImageUrl || '',
    themeColor: raw.themeColor || '#e11d48',
    minOrderValue: paiseToRupees(raw.minOrderValue),
    categories: Array.isArray(raw.cuisine) ? raw.cuisine : [],
    isAvailable: raw.isActive !== false,
    isOwned: raw.isOwned !== false,
    commissionPct: raw.commissionPct ?? undefined,
    // Ratings and delivery estimates are intentionally omitted: the database
    // does not have them and the review system is not built yet.
  };
}

export function mapApiMenuItem(raw: ApiMenuItem): MenuItem {
  const brandSlug = raw.brandKitchen?.brand?.slug;
  const hubs = liveHubs(raw);

  return {
    id: raw.id,
    brandId: brandSlug || '',
    brandName: raw.brandKitchen?.brand?.name || undefined,
    availableHubIds: hubs.ids,
    availableHubNames: Object.keys(hubs.names).length > 0 ? hubs.names : undefined,
    name: raw.name,
    description: raw.description || '',
    mrp: paiseToRupees(raw.mrpInPaise),
    memberPrice: paiseToRupees(raw.memberPriceInPaise),
    image: raw.imageUrl || '',
    isVeg: raw.isVeg !== false,
    isBestseller: raw.isBestseller === true,
    category: raw.category || '',
    dietType: (raw.dietType as MenuItem['dietType']) || undefined,
    spiceLevel: raw.spiceLevel ?? undefined,
    gstPct: raw.gstPct ?? undefined,
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((variant) => ({
          name: variant.name,
          priceInPaise: variant.priceInPaise,
        }))
      : undefined,
    addOns: Array.isArray(raw.addOns)
      ? raw.addOns.map((addOn) => ({
          name: addOn.name,
          priceInPaise: addOn.priceInPaise,
        }))
      : undefined,
    customizationGroups: optionGroups(raw),
    isAvailable: raw.isAvailable !== false,
  };
}

export function mapApiBrands(rows: ApiBrand[] | null | undefined): Brand[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && row.slug).map(mapApiBrand);
}

export function mapApiMenuItems(rows: ApiMenuItem[] | null | undefined): MenuItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && row.id).map(mapApiMenuItem);
}
