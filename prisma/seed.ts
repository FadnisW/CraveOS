import { PrismaClient } from '@prisma/client';
import { MOCK_MENU_ITEMS } from '../src/data/mockData';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Updating CraveOS Multi-Brand Cloud Kitchen Database with local Brand Logos & Banners...');

  // 1. Create Hubs with Operating Hours
  const hubHsr = await prisma.hub.upsert({
    where: { id: 'hub-hsr-01' },
    update: {
      operatingHoursStart: '08:00',
      operatingHoursEnd: '03:00',
    },
    create: {
      id: 'hub-hsr-01',
      name: 'HSR Layout Cloud Kitchen Hub #01',
      city: 'Bengaluru',
      lat: 12.9121,
      lng: 77.6445,
      operatingHoursStart: '08:00',
      operatingHoursEnd: '03:00',
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
    update: {
      operatingHoursStart: '08:00',
      operatingHoursEnd: '03:00',
    },
    create: {
      id: 'hub-indiranagar-02',
      name: 'Indiranagar Hub #02',
      city: 'Bengaluru',
      lat: 12.9719,
      lng: 77.6412,
      operatingHoursStart: '08:00',
      operatingHoursEnd: '03:00',
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

  // 3. Seed Users with Operational Roles & Scoped Permissions
  const usersData = [
    {
      id: 'usr-super-admin',
      phone: '+919999900001',
      email: 'superadmin@eatclub.in',
      name: 'System Super Admin',
      role: 'ADMIN',
      adminSubRole: 'SUPER_ADMIN' as const,
      referralCode: 'SUPERADMIN01',
    },
    {
      id: 'usr-ops-admin',
      phone: '+919999900002',
      email: 'opsadmin@eatclub.in',
      name: 'Operations Admin',
      role: 'ADMIN',
      adminSubRole: 'OPERATIONS_ADMIN' as const,
      referralCode: 'OPSADMIN01',
    },
    {
      id: 'usr-hub-mgr-hsr',
      phone: '+919999900003',
      email: 'hsr.manager@eatclub.in',
      name: 'Ramesh Kumar (HSR Hub Mgr)',
      role: 'HUB_MANAGER',
      scopedHubId: hubHsr.id,
      referralCode: 'HUBMGRHSR',
    },
    {
      id: 'usr-brand-ops-mojo',
      phone: '+919999900004',
      email: 'mojo.ops@eatclub.in',
      name: 'Priya Sharma (MOJO Brand Ops)',
      role: 'BRAND_OPS',
      scopedBrandId: 'mojo-pizza',
      referralCode: 'MOJOOPS01',
    },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        phone: u.phone,
        email: u.email,
        name: u.name,
        role: u.role,
        adminSubRole: u.adminSubRole,
        scopedHubId: u.scopedHubId,
        scopedBrandId: u.scopedBrandId,
      },
      create: u,
    });
  }

  // 4. Demo customer used by the storefront's sign-in shortcut.
  //    The storefront keeps an address book in localStorage, but orders can
  //    only reference database rows owned by the buyer — so these must exist.
  const demoCustomer = await prisma.user.upsert({
    where: { id: 'usr-101' },
    update: {
      email: 'alex.morgan@eatclub.in',
      name: 'Alex Morgan',
      phone: '+919876543210',
      role: 'CUSTOMER',
      walletBalance: 25000,
    },
    create: {
      id: 'usr-101',
      email: 'alex.morgan@eatclub.in',
      name: 'Alex Morgan',
      phone: '+919876543210',
      role: 'CUSTOMER',
      walletBalance: 25000,
      referralCode: 'EATALEX50',
    },
  });

  await prisma.membership.upsert({
    where: { userId: demoCustomer.id },
    update: {
      status: 'ACTIVE',
      planId: 'STANDARD_TRIAL',
      renewsAt: new Date('2027-12-31T00:00:00.000Z'),
    },
    create: {
      userId: demoCustomer.id,
      status: 'ACTIVE',
      planId: 'STANDARD_TRIAL',
      renewsAt: new Date('2027-12-31T00:00:00.000Z'),
    },
  });

  const demoAddresses = [
    {
      id: 'addr-1',
      type: 'HOME' as const,
      label: 'Home',
      addressLine: 'Flat 402, Sunshine Heights, HSR Layout Sector 2',
      city: 'Bengaluru',
      pincode: '560102',
      lat: 12.9121,
      lng: 77.6445,
      resolvedHubId: hubHsr.id,
      isDefault: true,
    },
    {
      id: 'addr-2',
      type: 'WORK' as const,
      label: 'Office HQ',
      addressLine: 'Building 7, Embassy TechVillage, Outer Ring Road',
      city: 'Bengaluru',
      pincode: '560103',
      lat: 12.926,
      lng: 77.683,
      resolvedHubId: hubHsr.id,
      isDefault: false,
    },
    {
      id: 'addr-3',
      type: 'OTHER' as const,
      label: 'Indiranagar Stay',
      addressLine: '100ft Road, Near Metro Station, Indiranagar',
      city: 'Bengaluru',
      pincode: '560038',
      lat: 12.9719,
      lng: 77.6412,
      resolvedHubId: hubIndiranagar.id,
      isDefault: false,
    },
  ];

  for (const address of demoAddresses) {
    await prisma.address.upsert({
      where: { id: address.id },
      update: { ...address, userId: demoCustomer.id },
      create: { ...address, userId: demoCustomer.id },
    });
  }

  // 5. Seed Riders (APPROVED, PENDING_APPROVAL, SUSPENDED)
  const ridersData = [
    {
      id: 'rider-1',
      phone: '+919900011101',
      name: 'Rahul Sharma',
      status: 'APPROVED' as const,
      vehicleType: 'BIKE',
      vehicleRegNo: 'KA01EA1234',
      licenceDocUrl: 'https://docs.eatclub.in/licences/r1.pdf',
      vehicleRcDocUrl: 'https://docs.eatclub.in/rc/r1.pdf',
      bankAccountRef: 'REF-BANK-R1-88',
      upiId: 'rahul.rider@upi',
      isOnline: true,
      liveLat: 12.9125,
      liveLng: 77.6448,
      currentHubId: hubHsr.id,
      capacityMax: 2,
      rating: 4.9,
      approvedAt: new Date(),
    },
    {
      id: 'rider-2',
      phone: '+919900011102',
      name: 'Vikas Kumar',
      status: 'APPROVED' as const,
      vehicleType: 'SCOOTER',
      vehicleRegNo: 'KA05MK5678',
      licenceDocUrl: 'https://docs.eatclub.in/licences/r2.pdf',
      vehicleRcDocUrl: 'https://docs.eatclub.in/rc/r2.pdf',
      bankAccountRef: 'REF-BANK-R2-99',
      upiId: 'vikas.rider@upi',
      isOnline: true,
      liveLat: 12.9722,
      liveLng: 77.6415,
      currentHubId: hubIndiranagar.id,
      capacityMax: 1,
      rating: 4.8,
      approvedAt: new Date(),
    },
    {
      id: 'rider-3',
      phone: '+919900011103',
      name: 'Amit Patel',
      status: 'APPROVED' as const,
      vehicleType: 'BIKE',
      vehicleRegNo: 'KA03HX9988',
      isOnline: false,
      currentHubId: hubHsr.id,
      rating: 4.7,
      approvedAt: new Date(),
    },
    {
      id: 'rider-4',
      phone: '+919900011104',
      name: 'Suresh Gowda',
      status: 'PENDING_APPROVAL' as const,
      vehicleType: 'BICYCLE',
      isOnline: false,
    },
    {
      id: 'rider-5',
      phone: '+919900011105',
      name: 'Deepak Singh',
      status: 'SUSPENDED' as const,
      vehicleType: 'BIKE',
      vehicleRegNo: 'KA02JL4321',
      isOnline: false,
      rating: 3.8,
    },
    {
      id: 'rider-6',
      phone: '+919900011106',
      name: 'Karan Mehta',
      status: 'APPROVED' as const,
      vehicleType: 'BIKE',
      vehicleRegNo: 'KA51Z1122',
      isOnline: true,
      liveLat: 12.9130,
      liveLng: 77.6450,
      currentHubId: hubHsr.id,
      rating: 4.95,
      approvedAt: new Date(),
    },
  ];

  for (const r of ridersData) {
    await prisma.rider.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    });
  }

  // 5. Seed Rider Earnings
  const earningsData = [
    { id: 're-1', riderId: 'rider-1', type: 'BASE_FEE', amountInPaise: 4000 },
    { id: 're-2', riderId: 'rider-1', type: 'DISTANCE_FEE', amountInPaise: 2500 },
    { id: 're-3', riderId: 'rider-1', type: 'TIP', amountInPaise: 3000 },
    { id: 're-4', riderId: 'rider-2', type: 'BASE_FEE', amountInPaise: 4000 },
    { id: 're-5', riderId: 'rider-2', type: 'SURGE', amountInPaise: 1500 },
    { id: 're-6', riderId: 'rider-6', type: 'INCENTIVE', amountInPaise: 5000 },
  ];

  for (const e of earningsData) {
    await prisma.riderEarning.upsert({
      where: { id: e.id },
      update: e,
      create: e,
    });
  }

  // 6. Seed Support & Dispute Tickets
  const ticketsData = [
    {
      id: 'tkt-1',
      raisedByType: 'CUSTOMER',
      raisedById: 'usr-101',
      category: 'LATE_DELIVERY',
      status: 'OPEN' as const,
      priority: 'HIGH',
    },
    {
      id: 'tkt-2',
      raisedByType: 'HUB',
      raisedById: 'usr-hub-mgr-hsr',
      category: 'MISSING_ITEM',
      status: 'RESOLVED' as const,
      assignedToId: 'usr-ops-admin',
      priority: 'NORMAL',
      resolutionNote: 'Kitchen dispatched replacement item via express rider.',
      resolvedAt: new Date(),
    },
    {
      id: 'tkt-3',
      raisedByType: 'RIDER',
      raisedById: 'rider-1',
      category: 'RIDER_SAFETY',
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT',
    },
  ];

  for (const t of ticketsData) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }

  // 7. Seed Enriched Menu Items
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
      dietType: 'VEG',
      spiceLevel: 1,
      gstPct: 5,
      variants: [{ name: '10 Inch Pan', priceInPaise: 34900 }, { name: '12 Inch Cheese Burst', priceInPaise: 49900 }],
      addOns: [{ name: 'Extra Mozzarella', priceInPaise: 6900 }, { name: 'Jalapenos', priceInPaise: 3900 }],
      scheduledFrom: '10:00',
      scheduledTo: '02:30',
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
      dietType: 'NON_VEG',
      spiceLevel: 2,
      gstPct: 5,
      variants: [{ name: '10 Inch Pan', priceInPaise: 37900 }],
      addOns: [{ name: 'Extra BBQ Chicken', priceInPaise: 8900 }],
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
      dietType: 'VEG',
      spiceLevel: 0,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 1,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 3,
      gstPct: 5,
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
      dietType: 'NON_VEG',
      spiceLevel: 2,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 0,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 0,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 0,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 1,
      gstPct: 5,
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
      dietType: 'NON_VEG',
      spiceLevel: 2,
      gstPct: 5,
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
      dietType: 'NON_VEG',
      spiceLevel: 3,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 2,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 1,
      gstPct: 5,
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
      dietType: 'NON_VEG',
      spiceLevel: 0,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 2,
      gstPct: 5,
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
      dietType: 'VEG',
      spiceLevel: 1,
      gstPct: 5,
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
        dietType: item.dietType,
        spiceLevel: item.spiceLevel,
        gstPct: item.gstPct,
        variants: item.variants ? JSON.parse(JSON.stringify(item.variants)) : undefined,
        addOns: item.addOns ? JSON.parse(JSON.stringify(item.addOns)) : undefined,
        scheduledFrom: item.scheduledFrom,
        scheduledTo: item.scheduledTo,
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
        dietType: item.dietType,
        spiceLevel: item.spiceLevel,
        gstPct: item.gstPct,
        variants: item.variants ? JSON.parse(JSON.stringify(item.variants)) : undefined,
        addOns: item.addOns ? JSON.parse(JSON.stringify(item.addOns)) : undefined,
        scheduledFrom: item.scheduledFrom,
        scheduledTo: item.scheduledTo,
      },
    });
  }

  console.log('✅ Menu items, operational users, riders, earnings, and tickets seeded successfully.');

  // 8. Catalog parity — the storefront's MOCK_MENU_ITEMS is its advertised
  //    catalogue. Any item that exists there but not in the database would
  //    render as orderable and then fail at checkout with "no longer on the
  //    menu". Upsert only missing rows so curated prices are never clobbered.
  const seededMenuItemIds = new Set(menuItemsData.map((item) => item.id));
  let parityAdded = 0;

  for (const item of MOCK_MENU_ITEMS) {
    if (seededMenuItemIds.has(item.id)) continue;

    const brandKitchenId = brandKitchenMap[item.brandId];
    if (!brandKitchenId) {
      console.warn(`⚠️  Skipping ${item.id}: no HSR brand kitchen for '${item.brandId}'`);
      continue;
    }

    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        brandKitchenId,
        name: item.name,
        description: item.description,
        mrpInPaise: Math.round(item.mrp * 100),
        memberPriceInPaise: Math.round(item.memberPrice * 100),
        imageUrl: item.image,
        isVeg: item.isVeg,
        isBestseller: !!item.isBestseller,
        isAvailable: item.isAvailable !== false,
        category: item.category,
        rating: item.rating,
        dietType: item.dietType || (item.isVeg ? 'VEG' : 'NON_VEG'),
        spiceLevel: item.spiceLevel ?? 1,
        gstPct: item.gstPct ?? 5,
        variants: item.variants ? JSON.parse(JSON.stringify(item.variants)) : undefined,
        addOns: item.addOns ? JSON.parse(JSON.stringify(item.addOns)) : undefined,
      },
    });

    parityAdded += 1;
  }

  console.log(`✅ Catalog parity: ${parityAdded} storefront items added to the database.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

