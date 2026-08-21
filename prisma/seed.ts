import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Updating CraveOS Multi-Brand Cloud Kitchen Database with local Brand Logos & Banners...');

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

  // 2. Create All 8 Brands with Exact Local Assets from /public/Brand Logo
  const brandsData = [
    {
      id: 'mojo-pizza',
      name: 'MOJO Pizza- 2X Toppings',
      slug: 'mojo-pizza',
      tagline: "India's Highest Rated Pizza Delivery Chain",
      cuisine: ['Pizza', 'Italian', 'Fast Food'],
      logoUrl: '/Brand Logo/Mojo Pizza.png',
      heroImageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800&auto=format&fit=crop&q=80',
      themeColor: '#FF6B00',
      minOrderValue: 19900,
    },
    {
      id: 'leancrust',
      name: 'LeanCrust Pizza',
      slug: 'leancrust',
      tagline: 'The Thin Crust Experts',
      cuisine: ['Gourmet Thin Crust', 'Cheesy Garlic Breads', 'Salads'],
      logoUrl: '/Brand Logo/LeanCrust Pizza.png',
      heroImageUrl: '/Brand Logo/LeanPizza banner.webp',
      themeColor: '#3B82F6',
      minOrderValue: 22900,
    },
    {
      id: 'box8',
      name: 'BOX8 - Desi Meals',
      slug: 'box8',
      tagline: "India's Largest Desi Meals Brand",
      cuisine: ['North Indian', 'Thalis', 'Biryani', 'Curries'],
      logoUrl: '/Brand Logo/Box8.png',
      heroImageUrl: '/Brand Logo/Box8 PBanner.webp',
      themeColor: '#D97706',
      minOrderValue: 14900,
    },
    {
      id: 'wefit',
      name: 'WeFit - Protein Meals',
      slug: 'wefit',
      tagline: 'Upto 65 gm Protein in Bowls, Salads & Sandwiches',
      cuisine: ['Healthy', 'Salads', 'Keto', 'Protein Bowls'],
      logoUrl: '/Brand Logo/Wefit.png',
      heroImageUrl: '/Brand Logo/WeFit Banner.webp',
      themeColor: '#10B981',
      minOrderValue: 16900,
    },
    {
      id: 'zaza-biryani',
      name: 'ZAZA Mughal Biryani',
      slug: 'zaza-biryani',
      tagline: "India's Most Flavourful Biryani",
      cuisine: ['Biryani', 'Mughlai', 'Kebabs'],
      logoUrl: '/Brand Logo/Zaza.png',
      heroImageUrl: '/Brand Logo/Zaza Banner.webp',
      themeColor: '#8B5CF6',
      minOrderValue: 17900,
    },
    {
      id: 'nh1-bowls',
      name: 'NH1 Bowls',
      slug: 'nh1-bowls',
      tagline: 'Highway to North! Real North-Indian Taste.',
      cuisine: ['North Indian', 'Bowls', 'Rajma', 'Chole'],
      logoUrl: '/Brand Logo/NH1 Logo.png',
      heroImageUrl: '/Brand Logo/NH1 Banner.webp',
      themeColor: '#DC2626',
      minOrderValue: 13900,
    },
    {
      id: 'mealful-rolls',
      name: 'Mealful Rolls - Big 8-Inch Rolls',
      slug: 'mealful-rolls',
      tagline: 'Double Filled 8-Inch Loaded Wraps',
      cuisine: ['Rolls', 'Wraps', 'Kathi Rolls'],
      logoUrl: '/Brand Logo/Mealful Logo.png',
      heroImageUrl: '/Brand Logo/Mealful Banner.jpg',
      themeColor: '#D97706',
      minOrderValue: 12900,
    },
    {
      id: 'zulus-pizza',
      name: "Zulu's Pizza - Wholesale Pizzas",
      slug: 'zulus-pizza',
      tagline: 'Giant 12" Wholesale Pizzas & Value Combos',
      cuisine: ['Wholesale Pizzas', 'Jumbo Crusts', 'Cheesy Sides'],
      logoUrl: '/Brand Logo/Zulu Logo.png',
      heroImageUrl: '/Brand Logo/Zulu Banner.jpg',
      themeColor: '#F59E0B',
      minOrderValue: 19900,
    },
  ];

  const brandKitchenMap: Record<string, string> = {};

  for (const b of brandsData) {
    await prisma.brand.upsert({
      where: { id: b.id },
      update: {
        name: b.name,
        slug: b.slug,
        tagline: b.tagline,
        cuisine: b.cuisine,
        logoUrl: b.logoUrl,
        heroImageUrl: b.heroImageUrl,
        themeColor: b.themeColor,
        minOrderValue: b.minOrderValue,
      },
      create: b,
    });

    // Create BrandKitchen mapping for HSR Hub
    const bkHsr = await prisma.brandKitchen.upsert({
      where: { brandId_hubId: { brandId: b.id, hubId: hubHsr.id } },
      update: {},
      create: {
        brandId: b.id,
        hubId: hubHsr.id,
        isOpen: true,
      },
    });

    brandKitchenMap[b.id] = bkHsr.id;

    // Create BrandKitchen mapping for Indiranagar Hub
    await prisma.brandKitchen.upsert({
      where: { brandId_hubId: { brandId: b.id, hubId: hubIndiranagar.id } },
      update: {},
      create: {
        brandId: b.id,
        hubId: hubIndiranagar.id,
        isOpen: true,
      },
    });
  }

  console.log('✅ Brands updated with exact local logos and banners.');

  // 3. Seed Menu Items
  const menuItemsData = [
    // MOJO PIZZA
    {
      id: 'pz-1',
      brandId: 'mojo-pizza',
      name: 'Crowd Favorite Pepperoni & Paneer 10"',
      description: 'Loaded with 2X toppings, juicy paneer cubes, capsicum, red paprika & 100% mozzarella cheese.',
      mrpInPaise: 49900,
      memberPriceInPaise: 34900,
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Pizza',
      rating: 4.9,
    },
    {
      id: 'pz-2',
      brandId: 'mojo-pizza',
      name: 'Chicken Supreme 2X Topping 10"',
      description: 'Loaded with Grilled Chicken, BBQ Chicken, Jalapenos, Mushrooms & Extra Mozzarella.',
      mrpInPaise: 54900,
      memberPriceInPaise: 37900,
      imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=80',
      isVeg: false,
      isBestseller: true,
      category: 'Pizza',
      rating: 4.8,
    },
    {
      id: 'pz-3',
      brandId: 'mojo-pizza',
      name: 'Classic Margherita Overload 10"',
      description: 'Double layer of 100% mozzarella cheese infused with basil olive oil.',
      mrpInPaise: 37900,
      memberPriceInPaise: 24900,
      imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Pizza',
      rating: 4.7,
    },
    {
      id: 'pz-4',
      brandId: 'mojo-pizza',
      name: 'Farmhouse Veggie Feast 10"',
      description: 'Capsicum, onion, tomato, sweet corn & mushrooms with Italian herb seasoning.',
      mrpInPaise: 44900,
      memberPriceInPaise: 29900,
      imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: false,
      category: 'Pizza',
      rating: 4.6,
    },
    {
      id: 'pz-5',
      brandId: 'mojo-pizza',
      name: 'Fiery Spicy Paneer 10"',
      description: 'Spicy peri-peri paneer, red paprika, jalapenos, and spicy sriracha drizzle.',
      mrpInPaise: 47900,
      memberPriceInPaise: 32900,
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: false,
      category: 'Pizza',
      rating: 4.8,
    },
    {
      id: 'pz-6',
      brandId: 'mojo-pizza',
      name: 'Smokey BBQ Chicken Feast 10"',
      description: 'Smokey BBQ chicken chunks, caramelized onions, green peppers & mozzarella.',
      mrpInPaise: 52900,
      memberPriceInPaise: 36900,
      imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=80',
      isVeg: false,
      isBestseller: false,
      category: 'Pizza',
      rating: 4.7,
    },

    // LEANCRUST
    {
      id: 'tc-1',
      brandId: 'leancrust',
      name: 'Gourmet Truffle Mushroom ThinCrust 11"',
      description: 'Ultra thin crispy crust with wild mushrooms, truffle oil, and melted fontina.',
      mrpInPaise: 49900,
      memberPriceInPaise: 34900,
      imageUrl: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'ThinCrust',
      rating: 4.9,
    },
    {
      id: 'tc-2',
      brandId: 'leancrust',
      name: 'Fresh Basil Pesto & Burrata ThinCrust 11"',
      description: 'House-made basil pesto sauce, cherry tomatoes, and creamy burrata cheese.',
      mrpInPaise: 52900,
      memberPriceInPaise: 36900,
      imageUrl: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'ThinCrust',
      rating: 4.8,
    },
    {
      id: 'tc-3',
      brandId: 'leancrust',
      name: 'Quattro Formaggi Four Cheese ThinCrust 11"',
      description: 'Mozzarella, cheddar, parmesan & gorgonzola on an ultra-light thin crust.',
      mrpInPaise: 47900,
      memberPriceInPaise: 32900,
      imageUrl: 'https://images.unsplash.com/photo-1588315029754-2dd089d39a1a?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: false,
      category: 'ThinCrust',
      rating: 4.7,
    },

    // BOX8
    {
      id: 'th-1',
      brandId: 'box8',
      name: 'Paneer Royal Thali Meal',
      description: 'Creamy Shahi Paneer, Dal Makhani, Parathas (2 pcs), Jeera Rice, Gulab Jamun & Salad.',
      mrpInPaise: 32900,
      memberPriceInPaise: 22900,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Thali',
      rating: 4.8,
    },
    {
      id: 'th-2',
      brandId: 'box8',
      name: 'Butter Chicken Maharaja Thali',
      description: 'Tender chicken in rich makhani gravy, Dal Makhani, Jeera Rice, Paratha, Salad & Sweet.',
      mrpInPaise: 36900,
      memberPriceInPaise: 25900,
      imageUrl: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80',
      isVeg: false,
      isBestseller: true,
      category: 'Thali',
      rating: 4.9,
    },

    // ZAZA BIRYANI
    {
      id: 'by-1',
      brandId: 'zaza-biryani',
      name: 'ZAZA Royal Hyderabadi Dum Chicken Biryani',
      description: 'Long grain basmati rice layered with marinated chicken, saffron & whole spices. Served with Mirchi Ka Salan.',
      mrpInPaise: 35900,
      memberPriceInPaise: 24900,
      imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
      isVeg: false,
      isBestseller: true,
      category: 'Biryani',
      rating: 4.9,
    },
    {
      id: 'by-2',
      brandId: 'zaza-biryani',
      name: 'Lucknowi Shahi Paneer Dum Biryani',
      description: 'Fragrant aromatic biryani rice cooked with tender tandoori paneer cubes & fried onions.',
      mrpInPaise: 32900,
      memberPriceInPaise: 22900,
      imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Biryani',
      rating: 4.8,
    },

    // NH1 BOWLS
    {
      id: 'bw-1',
      brandId: 'nh1-bowls',
      name: 'NH1 Highway Rajma Rice Bowl',
      description: 'Authentic North Indian Rajma cooked in thick onion-tomato gravy over cumin basmati rice.',
      mrpInPaise: 21900,
      memberPriceInPaise: 14900,
      imageUrl: 'https://images.unsplash.com/photo-1543352634-99a5d50ae78e?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Bowl',
      rating: 4.8,
    },

    // WEFIT
    {
      id: 'hp-1',
      brandId: 'wefit',
      name: '60g Protein Grilled Chicken Quinoa Salad',
      description: 'Herb grilled chicken breast, organic quinoa, avocado, cherry tomatoes & lemon vinaigrette.',
      mrpInPaise: 37900,
      memberPriceInPaise: 25900,
      imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80',
      isVeg: false,
      isBestseller: true,
      category: 'High Protein',
      rating: 4.9,
    },

    // MEALFUL ROLLS
    {
      id: 'rl-1',
      brandId: 'mealful-rolls',
      name: 'Double Loaded Paneer Tikka 8" Roll',
      description: '2X chargrilled paneer tikka chunks wrapped in a soft multi-grain laccha paratha with mint mayo.',
      mrpInPaise: 24900,
      memberPriceInPaise: 16900,
      imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Rolls',
      rating: 4.8,
    },

    // ZULU'S PIZZA
    {
      id: 'zp-1',
      brandId: 'zulus-pizza',
      name: 'Wholesale 12" Jumbo Cheese Burst Pizza',
      description: 'Giant 12 inch crust overflowing with liquid cheese and double mozzarella topping.',
      mrpInPaise: 59900,
      memberPriceInPaise: 39900,
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80',
      isVeg: true,
      isBestseller: true,
      category: 'Pizza',
      rating: 4.8,
    },
  ];

  for (const item of menuItemsData) {
    const bkId = brandKitchenMap[item.brandId];
    if (!bkId) continue;

    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        mrpInPaise: item.mrpInPaise,
        memberPriceInPaise: item.memberPriceInPaise,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        isBestseller: item.isBestseller,
        category: item.category,
        rating: item.rating,
      },
      create: {
        id: item.id,
        brandKitchenId: bkId,
        name: item.name,
        description: item.description,
        mrpInPaise: item.mrpInPaise,
        memberPriceInPaise: item.memberPriceInPaise,
        imageUrl: item.imageUrl,
        isVeg: item.isVeg,
        isBestseller: item.isBestseller,
        isAvailable: true,
        category: item.category,
        rating: item.rating,
      },
    });
  }

  console.log('✅ Menu items updated.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
