import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CraveOS Multi-Brand Cloud Kitchen Database...');

  // 1. Create Hubs
  const hubHsr = await prisma.hub.upsert({
    where: { id: 'hub-hsr-01' },
    update: {},
    create: {
      id: 'hub-hsr-01',
      name: 'HSR Layout Cloud Kitchen Hub #01',
      city: 'Bengaluru',
      lat: 12.9121,
      lng: 77.6445,
      servicePolygon: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6300, 12.9000],
            [77.6600, 12.9000],
            [77.6600, 12.9300],
            [77.6300, 12.9300],
            [77.6300, 12.9000],
          ],
        ],
      },
    },
  });

  const hubIndiranagar = await prisma.hub.upsert({
    where: { id: 'hub-indiranagar-02' },
    update: {},
    create: {
      id: 'hub-indiranagar-02',
      name: 'Indiranagar Hub #02',
      city: 'Bengaluru',
      lat: 12.9719,
      lng: 77.6412,
      servicePolygon: {
        type: 'Polygon',
        coordinates: [
          [
            [77.6200, 12.9600],
            [77.6600, 12.9600],
            [77.6600, 12.9900],
            [77.6200, 12.9900],
            [77.6200, 12.9600],
          ],
        ],
      },
    },
  });

  console.log('✅ Hubs seeded:', hubHsr.name, hubIndiranagar.name);

  // 2. Create In-House Brands
  const brandsData = [
    {
      id: 'box8',
      name: 'BOX8 - Desi Meals',
      slug: 'box8',
      tagline: 'All-in-1 Desi Meals, Curries, Thalis & Biryanis',
      cuisine: ['North Indian', 'Thalis', 'Biryani'],
      logoUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=150&auto=format&fit=crop&q=80',
      heroImageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&auto=format&fit=crop&q=80',
      themeColor: '#E11D48',
      minOrderValue: 14900,
    },
    {
      id: 'mojo-pizza',
      name: 'MOJO Pizza - 2X Toppings',
      slug: 'mojo-pizza',
      tagline: 'Loaded with 2X Toppings on Every Slice',
      cuisine: ['Pizza', 'Italian', 'Fast Food'],
      logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&auto=format&fit=crop&q=80',
      heroImageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800&auto=format&fit=crop&q=80',
      themeColor: '#DC2626',
      minOrderValue: 19900,
    },
    {
      id: 'zaza-biryani',
      name: 'ZAZA - Mughal Biryani',
      slug: 'zaza-biryani',
      tagline: 'Authentic Slow-Cooked Dum Biryanis',
      cuisine: ['Biryani', 'Mughlai', 'Kebabs'],
      logoUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=150&auto=format&fit=crop&q=80',
      heroImageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800&auto=format&fit=crop&q=80',
      themeColor: '#7C3AED',
      minOrderValue: 17900,
    },
    {
      id: 'wefit',
      name: 'WeFit - High Protein Bowls',
      slug: 'wefit',
      tagline: 'Macro-Counted Clean Bowls, Salads & Keto Meals',
      cuisine: ['Healthy', 'Salads', 'Keto'],
      logoUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80',
      heroImageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
      themeColor: '#2563EB',
      minOrderValue: 16900,
    },
  ];

  for (const b of brandsData) {
    const brand = await prisma.brand.upsert({
      where: { id: b.id },
      update: {},
      create: b,
    });

    // Create BrandKitchen mapping for HSR Hub
    const bk = await prisma.brandKitchen.upsert({
      where: { brandId_hubId: { brandId: b.id, hubId: hubHsr.id } },
      update: {},
      create: {
        brandId: b.id,
        hubId: hubHsr.id,
        isOpen: true,
      },
    });

    // Seed Menu Items
    if (b.id === 'box8') {
      await prisma.menuItem.createMany({
        data: [
          {
            brandKitchenId: bk.id,
            name: 'Paneer Royal Thali Meal',
            description: 'Creamy Shahi Paneer, Dal Makhani, Parathas (2 pcs), Jeera Rice, Gulab Jamun & Salad.',
            mrpInPaise: 32900,
            memberPriceInPaise: 22900,
            imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
            isVeg: true,
            isBestseller: true,
            category: 'Thalis',
            rating: 4.7,
          },
          {
            brandKitchenId: bk.id,
            name: 'Butter Chicken All-in-1 Meal',
            description: 'Tender chicken in rich makhani gravy, served with Jeera Rice, Paratha, Salad & Dessert.',
            mrpInPaise: 35900,
            memberPriceInPaise: 24900,
            imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80',
            isVeg: false,
            isBestseller: true,
            category: 'All-in-1 Meals',
            rating: 4.8,
          },
        ],
      });
    } else if (b.id === 'mojo-pizza') {
      await prisma.menuItem.createMany({
        data: [
          {
            brandKitchenId: bk.id,
            name: 'Crowd Favorite Pepperoni & Paneer 10"',
            description: 'Loaded with 2X toppings, juicy paneer cubes, capsicum, red paprika & 100% mozzarella cheese.',
            mrpInPaise: 49900,
            memberPriceInPaise: 34900,
            imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80',
            isVeg: true,
            isBestseller: true,
            category: 'Popular Pizzas',
            rating: 4.9,
          },
        ],
      });
    }
  }

  console.log('✅ Brands & Menu Items seeded successfully.');

  // 3. Create Membership Plans
  await prisma.membershipPlan.upsert({
    where: { id: 'plan-annual' },
    update: {},
    create: {
      id: 'plan-annual',
      name: 'Eatclub Annual Membership',
      durationDays: 365,
      priceInPaise: 29900,
      flatDiscountPct: 30,
    },
  });

  console.log('✅ Membership plans seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
