import { prisma, disconnectPrisma } from "../src/database/prisma.js";

const tenantSlug = "deliverhub-public";
const productsPerStore = 50;

const categories = [
  {
    slug: "grocery",
    name: "Хүнс",
    stores: ["Номин Супермаркет", "Fresh Mart", "Good Price Market", "Оргил Хүнс", "Minii Delguur"],
    products: [
      ["Цагаан будаа 5кг", "rice bag"], ["Гурил 2кг", "flour"], ["Сүү 1л", "milk bottle"], ["Өндөг 10ш", "eggs carton"], ["Тараг", "yogurt"],
      ["Алим", "apples"], ["Гадил", "bananas"], ["Төмс", "potatoes"], ["Сонгино", "onions"], ["Лууван", "carrots"],
      ["Үхрийн мах", "beef meat"], ["Тахианы мах", "chicken breast"], ["Загас", "fresh fish"], ["Цөцгийн тос", "butter"], ["Бяслаг", "cheese"],
    ],
  },
  {
    slug: "convenience",
    name: "24/7 дэлгүүр",
    stores: ["CU Mongolia", "GS25 Mongolia", "Quick Stop", "City Express", "Night Mart"],
    products: [
      ["Сэндвич", "sandwich"], ["Кимбап", "kimbap"], ["Рамен", "instant ramen"], ["Ус 500мл", "water bottle"], ["Кола", "cola can"],
      ["Энергийн ундаа", "energy drink"], ["Чипс", "potato chips"], ["Шоколад", "chocolate bar"], ["Зайрмаг", "ice cream"], ["Кофе лаазтай", "canned coffee"],
      ["Салат", "fresh salad"], ["Бэлэн хоол", "ready meal"], ["Жигнэмэг", "cookies"], ["Бохь", "chewing gum"], ["Цаасан аяга", "paper cups"],
    ],
  },
  {
    slug: "home-goods",
    name: "Гэр ахуй",
    stores: ["Home Plaza", "Ger Ahuin Tuv", "Cozy Home", "Kitchen House", "Houseware Hub"],
    products: [
      ["Тавагны сет", "dinnerware"], ["Аяга", "mug"], ["Хайруулын таваг", "frying pan"], ["Сав суулга", "cookware"], ["Хутганы сет", "kitchen knife"],
      ["Алчуур", "towel"], ["Орны даавуу", "bed sheets"], ["Дэр", "pillow"], ["Хөнжил", "blanket"], ["Хувцасны өлгүүр", "clothes hanger"],
      ["Сагс", "storage basket"], ["Хогийн сав", "trash bin"], ["Шүүр", "broom"], ["Цэвэрлэгээний багц", "cleaning supplies"], ["Лаа", "scented candle"],
    ],
  },
  {
    slug: "electronics",
    name: "Цахилгаан бараа",
    stores: ["Tech Hub", "Digital Mall", "Phone Center", "Smart Store", "Electro Shop"],
    products: [
      ["Чихэвч", "headphones"], ["Bluetooth speaker", "bluetooth speaker"], ["Гар утасны case", "phone case"], ["Цэнэглэгч", "phone charger"], ["Power bank", "power bank"],
      ["Keyboard", "keyboard"], ["Mouse", "computer mouse"], ["Laptop stand", "laptop stand"], ["Web camera", "webcam"], ["USB cable", "usb cable"],
      ["Smart watch", "smart watch"], ["Router", "wifi router"], ["Memory card", "memory card"], ["Tripod", "camera tripod"], ["Desk lamp", "desk lamp"],
    ],
  },
  {
    slug: "pharmacy",
    name: "Эмийн сан",
    stores: ["Pharma Plus", "Monos Express", "Health Care", "Vitamin House", "Apteka 24"],
    products: [
      ["Витамин C", "vitamin c"], ["Витамин D", "vitamin d"], ["Дархлаа дэмжигч", "supplements"], ["Гар ариутгагч", "hand sanitizer"], ["Маск", "medical mask"],
      ["Шархны наалт", "bandage"], ["Даралт хэмжигч", "blood pressure monitor"], ["Халуун хэмжигч", "thermometer"], ["Хүүхдийн сироп", "children medicine"], ["Нүдний дусаалга", "eye drops"],
      ["Арьс арчилгаа", "skincare pharmacy"], ["Нарны тос", "sunscreen"], ["Эмийн хайрцаг", "pill organizer"], ["Уураг", "protein powder"], ["Омега 3", "omega 3"],
    ],
  },
  {
    slug: "beauty",
    name: "Гоо сайхан",
    stores: ["Beauty Box", "Glow Market", "Skin Lab", "Cosmo Shop", "Makeup Studio"],
    products: [
      ["Уруулын будаг", "lipstick"], ["Сормуусны будаг", "mascara"], ["Суурь крем", "foundation makeup"], ["Нүүр цэвэрлэгч", "facial cleanser"], ["Чийгшүүлэгч тос", "moisturizer"],
      ["Үнэртэй ус", "perfume"], ["Шампунь", "shampoo"], ["Ангижруулагч", "conditioner"], ["Нүүрний маск", "face mask skincare"], ["Нарны тос", "sunscreen cosmetics"],
      ["Хумсны будаг", "nail polish"], ["Makeup brush", "makeup brushes"], ["Serum", "face serum"], ["Body lotion", "body lotion"], ["Hair oil", "hair oil"],
    ],
  },
  {
    slug: "books-stationery",
    name: "Ном, бичиг хэрэг",
    stores: ["Book Nest", "Аз Хур Ном", "Stationery Pro", "Student Shop", "Paper House"],
    products: [
      ["Уран зохиолын ном", "novel books"], ["Хүүхдийн ном", "children book"], ["Тэмдэглэлийн дэвтэр", "notebook"], ["Бал", "pen"], ["Харандаа", "pencils"],
      ["Файл хавтас", "file folder"], ["A4 цаас", "printer paper"], ["Marker", "markers"], ["Наадаг цаас", "sticky notes"], ["Үүргэвч", "school backpack"],
      ["Зургийн дэвтэр", "sketchbook"], ["Усан будаг", "watercolor paint"], ["Шугам", "ruler"], ["Тооны машин", "calculator"], ["Календарь", "calendar"],
    ],
  },
  {
    slug: "sports",
    name: "Спорт бараа",
    stores: ["Sport Zone", "Fit Market", "Outdoor Pro", "Bike House", "Active Gear"],
    products: [
      ["Гүйлтийн пүүз", "running shoes"], ["Иогийн дэвсгэр", "yoga mat"], ["Дамббелл", "dumbbells"], ["Усны сав", "sports water bottle"], ["Хөл бөмбөг", "football ball"],
      ["Сагсан бөмбөг", "basketball"], ["Дугуйн дуулга", "bike helmet"], ["Фитнес бээлий", "fitness gloves"], ["Спорт цүнх", "gym bag"], ["Resistance band", "resistance bands"],
      ["Майхан", "camping tent"], ["Аяны сандал", "camping chair"], ["Уулын гутал", "hiking boots"], ["Нүдний шил", "sports sunglasses"], ["Дугуйн гэрэл", "bike light"],
    ],
  },
  {
    slug: "kids-baby",
    name: "Хүүхдийн бараа",
    stores: ["Baby World", "Kids Planet", "Toy Land", "Little Star", "Mother Care"],
    products: [
      ["Живх", "diapers"], ["Baby wipes", "baby wipes"], ["Угж", "baby bottle"], ["Хүүхдийн тоглоом", "baby toys"], ["Puzzle", "kids puzzle"],
      ["Lego set", "building blocks"], ["Хүүхдийн хувцас", "baby clothes"], ["Хүүхдийн гутал", "kids shoes"], ["Тэрэг", "baby stroller"], ["Хүүхдийн сандал", "baby chair"],
      ["Зөөлөн тоглоом", "plush toy"], ["Сургалтын ном", "kids learning book"], ["Хүүхдийн шампунь", "baby shampoo"], ["Сүүн тэжээл", "baby formula"], ["Унтлагын хувцас", "kids pajamas"],
    ],
  },
  {
    slug: "pet-care",
    name: "Амьтны бараа",
    stores: ["Pet Care", "Happy Pet", "Dog & Cat", "Pet Food Market", "Animal House"],
    products: [
      ["Нохойн хоол", "dog food"], ["Муурын хоол", "cat food"], ["Амьтны тоглоом", "pet toys"], ["Оосор", "dog leash"], ["Муурын элс", "cat litter"],
      ["Амьтны шампунь", "pet shampoo"], ["Үүр", "pet bed"], ["Аквариум", "aquarium"], ["Загасны хоол", "fish food"], ["Тэжээлийн аяга", "pet bowl"],
      ["Сам", "pet brush"], ["Амттан", "pet treats"], ["Тээврийн цүнх", "pet carrier"], ["Хумс авагч", "pet nail clipper"], ["Шувууны хоол", "bird food"],
    ],
  },
];

const productPhotoUrls = [
  "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1607013251379-e6eecfffe234?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1583947581924-860bda6a26df?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=900&q=80",
];

const variantsByCategory = {
  "Хүнс": ["500г", "1кг", "2кг", "5кг", "багц"],
  "24/7 дэлгүүр": ["дан", "комбо", "том", "дунд", "2ш"],
  "Гэр ахуй": ["цагаан", "саарал", "хар", "дунд", "сет"],
  "Цахилгаан бараа": ["хар", "цагаан", "compact", "pro", "type-c"],
  "Эмийн сан": ["30ш", "60ш", "100мл", "250мл", "багц"],
  "Гоо сайхан": ["01", "02", "03", "50мл", "100мл"],
  "Ном, бичиг хэрэг": ["A4", "A5", "хатуу хавтастай", "зөөлөн хавтастай", "12ш"],
  "Спорт бараа": ["S", "M", "L", "XL", "багц"],
  "Хүүхдийн бараа": ["0-6 сар", "6-12 сар", "1-2 нас", "3-5 нас", "багц"],
  "Амьтны бараа": ["жижиг", "дунд", "том", "1кг", "3кг"],
};

const storeConfigs = categories.flatMap((category, categoryIndex) =>
  category.stores.map((name, storeIndex) => ({
    slug: `${category.slug}-${storeIndex + 1}`,
    name,
    type: category.name,
    categorySlug: category.slug,
    address: `Улаанбаатар, ${["Сүхбаатар", "Баянзүрх", "Хан-Уул", "Баянгол", "Чингэлтэй"][storeIndex % 5]} дүүрэг, ${name} салбар`,
    products: category.products,
    latitude: 47.89 + categoryIndex * 0.004 + storeIndex * 0.001,
    longitude: 106.86 + categoryIndex * 0.005 + storeIndex * 0.001,
  })),
);

function productTemplate(store, index) {
  const [baseName, keyword] = store.products[index % store.products.length];
  const variants = variantsByCategory[store.type] ?? ["дан", "дунд", "том", "2ш", "сет"];
  return {
    name: `${baseName} ${variants[Math.floor(index / store.products.length) % variants.length]}`.trim(),
    keyword,
  };
}

function productImage(store, index) {
  return productPhotoUrls[(storeConfigs.findIndex((item) => item.slug === store.slug) * 2 + index) % productPhotoUrls.length];
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: "DeliverHub Public" },
    create: { name: "DeliverHub Public", slug: tenantSlug },
  });

  for (let storeIndex = 0; storeIndex < storeConfigs.length; storeIndex += 1) {
    const config = storeConfigs[storeIndex];
    const store = await prisma.store.upsert({
      where: { slug: config.slug },
      update: {
        tenantId: tenant.id,
        name: config.name,
        description: config.type,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        name: config.name,
        slug: config.slug,
        description: config.type,
        isActive: true,
      },
    });

    const branch = await prisma.branch.upsert({
      where: { id: `${config.slug}-main-branch` },
      update: {
        name: "Үндсэн салбар",
        address: config.address,
        latitude: config.latitude,
        longitude: config.longitude,
      },
      create: {
        id: `${config.slug}-main-branch`,
        tenantId: tenant.id,
        storeId: store.id,
        name: "Үндсэн салбар",
        address: config.address,
        latitude: config.latitude,
        longitude: config.longitude,
      },
    });

    const warehouse = await prisma.warehouse.upsert({
      where: { id: `${config.slug}-warehouse` },
      update: { name: "Үндсэн агуулах" },
      create: {
        id: `${config.slug}-warehouse`,
        tenantId: tenant.id,
        branchId: branch.id,
        name: "Үндсэн агуулах",
      },
    });

    const category = await prisma.category.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: config.categorySlug,
        },
      },
      update: { name: config.type },
      create: {
        tenantId: tenant.id,
        name: config.type,
        slug: config.categorySlug,
      },
    });

    for (let index = 0; index < productsPerStore; index += 1) {
      const { name } = productTemplate(config, index);
      const productId = `${config.slug}-product-${index + 1}`;
      const sku = `${config.slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}-${String(index + 1).padStart(3, "0")}`;
      const product = await prisma.product.upsert({
        where: { id: productId },
        update: {
          name,
          description: `${config.name} дэлгүүрийн ${config.type.toLowerCase()} ангиллын бараа.`,
          categoryId: category.id,
          isActive: true,
        },
        create: {
          id: productId,
          tenantId: tenant.id,
          storeId: store.id,
          categoryId: category.id,
          name,
          description: `${config.name} дэлгүүрийн ${config.type.toLowerCase()} ангиллын бараа.`,
          isActive: true,
        },
      });

      const variant = await prisma.productVariant.upsert({
        where: { productId_sku: { productId: product.id, sku } },
        update: {
          name,
          priceMnt: BigInt(1800 + (index + 1) * 390 + storeIndex * 250),
          weightGrams: 180 + (index % 14) * 160,
        },
        create: {
          productId: product.id,
          sku,
          name,
          priceMnt: BigInt(1800 + (index + 1) * 390 + storeIndex * 250),
          weightGrams: 180 + (index % 14) * 160,
        },
      });

      await prisma.productMedia.deleteMany({ where: { productId: product.id } });
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          url: productImage(config, index),
          altText: name,
          sortOrder: 0,
        },
      });

      await prisma.inventoryItem.upsert({
        where: { warehouseId_variantId: { warehouseId: warehouse.id, variantId: variant.id } },
        update: { quantity: 30 + (index % 70), reserved: index % 4 },
        create: {
          warehouseId: warehouse.id,
          variantId: variant.id,
          quantity: 30 + (index % 70),
          reserved: index % 4,
        },
      });
    }
  }

  console.log(`Seeded ${storeConfigs.length} stores and ${storeConfigs.length * productsPerStore} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
