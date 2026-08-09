import { prisma, disconnectPrisma } from "../src/database/prisma.js";

const tenantSlug = "deliverhub-public";
const imageBase = "https://source.unsplash.com/900x650/?";

const storeConfigs = [
  { slug: "fresh-mart", name: "Fresh Mart", type: "Хүнсний дэлгүүр", categorySlug: "grocery", address: "Сүхбаатар дүүрэг, 1-р хороо, Central Tower", keywords: ["grocery", "vegetables", "fruit", "rice", "milk"] },
  { slug: "pharma-plus", name: "Pharma Plus", type: "Эмийн сан", categorySlug: "pharmacy", address: "Баянзүрх дүүрэг, 13-р хороолол, Peace Mall", keywords: ["pharmacy", "vitamin", "medicine", "health", "skincare"] },
  { slug: "tech-hub", name: "Tech Hub", type: "Цахилгаан бараа", categorySlug: "electronics", address: "Хан-Уул дүүрэг, Зайсан, Tech Plaza", keywords: ["electronics", "headphones", "laptop", "phone", "camera"] },
  { slug: "golden-bakery", name: "Golden Bakery", type: "Талх нарийн боов", categorySlug: "bakery", address: "Чингэлтэй дүүрэг, 5-р хороо, Bakery Street", keywords: ["bakery", "bread", "cake", "pastry", "cookie"] },
  { slug: "coffee-corner", name: "Coffee Corner", type: "Кофе, ундаа", categorySlug: "coffee-drinks", address: "Сүхбаатар дүүрэг, Seoul Street, Coffee block", keywords: ["coffee", "tea", "juice", "smoothie", "drink"] },
  { slug: "pet-care", name: "Pet Care", type: "Амьтны дэлгүүр", categorySlug: "pet-care", address: "Баянгол дүүрэг, 3-р хороо, Pet Center", keywords: ["pet food", "cat", "dog", "pet toy", "aquarium"] },
  { slug: "beauty-box", name: "Beauty Box", type: "Гоо сайхан", categorySlug: "beauty", address: "Хан-Уул дүүрэг, River Garden, Beauty Hall", keywords: ["beauty", "cosmetics", "perfume", "makeup", "shampoo"] },
  { slug: "book-nest", name: "Book Nest", type: "Ном, бичиг хэрэг", categorySlug: "books-stationery", address: "Сүхбаатар дүүрэг, Их сургуулийн гудамж", keywords: ["books", "stationery", "notebook", "pen", "library"] },
  { slug: "baby-world", name: "Baby World", type: "Хүүхдийн бараа", categorySlug: "baby-products", address: "Баянзүрх дүүрэг, Нарны зам, Baby center", keywords: ["baby", "toys", "diaper", "baby clothes", "kids"] },
  { slug: "sport-zone", name: "Sport Zone", type: "Спорт бараа", categorySlug: "sports", address: "Хан-Уул дүүрэг, Stadium road, Sport center", keywords: ["sports", "shoes", "fitness", "football", "bicycle"] },
];

const productSuffixes = [
  "стандарт", "премиум", "гэр бүлийн", "мини", "том савлагаа", "органик", "шинэ", "өдөр тутмын", "сонгодог", "тусгай",
  "хөнгөн", "бат бөх", "аялалын", "мэргэжлийн", "хэмнэлттэй", "шинэчлэгдсэн", "комбо", "супер", "ногоон", "хүүхдийн",
];

function productName(store, index) {
  const keyword = store.keywords[index % store.keywords.length];
  const suffix = productSuffixes[index % productSuffixes.length];
  return `${store.type} ${keyword} ${suffix} ${index + 1}`;
}

function productImage(store, index) {
  const keyword = encodeURIComponent(store.keywords[index % store.keywords.length]);
  return `${imageBase}${keyword},product&sig=${store.slug}-${index}`;
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
        description: `${config.type} - 100 бараатай demo маркет`,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        name: config.name,
        slug: config.slug,
        description: `${config.type} - 100 бараатай demo маркет`,
        isActive: true,
      },
    });

    const branch = await prisma.branch.upsert({
      where: { id: `${config.slug}-main-branch` },
      update: {
        name: "Үндсэн салбар",
        address: config.address,
        latitude: 47.91 + storeIndex * 0.003,
        longitude: 106.9 + storeIndex * 0.004,
      },
      create: {
        id: `${config.slug}-main-branch`,
        tenantId: tenant.id,
        storeId: store.id,
        name: "Үндсэн салбар",
        address: config.address,
        latitude: 47.91 + storeIndex * 0.003,
        longitude: 106.9 + storeIndex * 0.004,
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

    for (let index = 0; index < 100; index += 1) {
      const sku = `${config.slug.toUpperCase().slice(0, 4)}-${String(index + 1).padStart(3, "0")}`;
      const name = productName(config, index);
      const product = await prisma.product.upsert({
        where: { id: `${config.slug}-product-${index + 1}` },
        update: {
          name,
          description: `${config.name} маркетийн ${config.type.toLowerCase()} бараа.`,
          categoryId: category.id,
          isActive: true,
        },
        create: {
          id: `${config.slug}-product-${index + 1}`,
          tenantId: tenant.id,
          storeId: store.id,
          categoryId: category.id,
          name,
          description: `${config.name} маркетийн ${config.type.toLowerCase()} бараа.`,
          isActive: true,
        },
      });

      const variant = await prisma.productVariant.upsert({
        where: { productId_sku: { productId: product.id, sku } },
        update: {
          name,
          priceMnt: BigInt(2500 + (index + 1) * 450 + storeIndex * 900),
          weightGrams: 250 + (index % 12) * 180,
        },
        create: {
          productId: product.id,
          sku,
          name,
          priceMnt: BigInt(2500 + (index + 1) * 450 + storeIndex * 900),
          weightGrams: 250 + (index % 12) * 180,
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
        update: { quantity: 35 + (index % 60), reserved: index % 5 },
        create: {
          warehouseId: warehouse.id,
          variantId: variant.id,
          quantity: 35 + (index % 60),
          reserved: index % 5,
        },
      });
    }
  }

  console.log(`Seeded ${storeConfigs.length} stores and ${storeConfigs.length * 100} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
