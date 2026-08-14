export type NominCatalogProduct = {
  name: string;
  sku: string;
  category: string;
  priceMnt: number;
  weightGrams: number;
  stockCount: number;
  description: string;
  imageUrl: string;
};

export const nominStoreProfile = {
  id: "nomincart-public",
  name: "Номин Супермаркет",
  description: "Номин Супермаркетийн баталгаатай catalog",
  address: "Улаанбаатар хот",
  logoUrl: "https://www.mongoliansaddle.com/partners/Nomin%20supermarket.JPG",
};

const imageBase = "https://images.unsplash.com";

const nominCatalogRows: Array<[string, string, number, string]> = [
  ["Цагаан будаа 5кг", "Хүнс", 28000, "photo-1586201375761-83865001e31c"],
  ["Гурил 5кг", "Хүнс", 18500, "photo-1574323347407-f5e1ad6d020b"],
  ["Сүү 1л", "Сүү", 5200, "photo-1563636619-e9143da7973b"],
  ["Өндөг 10ш", "Хүнс", 9800, "photo-1582722872445-44dc5f7e3c8f"],
  ["Алим 1кг", "Жимс", 7800, "photo-1560806887-1e4cd0b6cbd6"],
  ["Төмс 2кг", "Ногоо", 6200, "photo-1518977676601-b53f82aba655"],
  ["Лууван 1кг", "Ногоо", 5400, "photo-1447175008436-054170c2e979"],
  ["Үхрийн мах 1кг", "Мах", 35000, "photo-1607623814075-e51df1bdc82f"],
  ["Тахианы цээж мах", "Мах", 20000, "photo-1604503468506-a8da13d82791"],
  ["Бяслаг 200г", "Сүү", 12400, "photo-1486297678162-eb2a19b0a32d"],
  ["Талх", "Талх", 3200, "photo-1509440159596-0249088772ff"],
  ["Цөцгийн тос", "Сүү", 8700, "photo-1589985270826-4b7bb135bc9d"],
  ["Йогурт", "Сүү", 3900, "photo-1488477181946-6428a0291777"],
  ["Гоймон", "Хүнс", 2800, "photo-1551892374-ecf8754cf8b0"],
  ["Спагетти", "Хүнс", 5600, "photo-1556761223-4c4282c73f77"],
  ["Кетчуп", "Соус", 6200, "photo-1604909052743-94e838986d24"],
  ["Майонез", "Соус", 7400, "photo-1621939514649-280e2ee25f60"],
  ["Наранцэцгийн тос", "Хүнс", 12900, "photo-1474979266404-7eaacbcd87c5"],
  ["Элсэн чихэр 1кг", "Хүнс", 4700, "photo-1581441363689-1f3c3c414635"],
  ["Давс", "Хүнс", 1900, "photo-1518110925495-5fe2fda0442c"],
  ["Ногоон цай", "Ундаа", 6900, "photo-1564890369478-c89ca6d9cde9"],
  ["Кофе", "Ундаа", 18900, "photo-1447933601403-0c6688de566e"],
  ["Ус 1.5л", "Ундаа", 2200, "photo-1523362628745-0c100150b504"],
  ["Minute Maid 1.25л", "Ундаа", 5500, "photo-1600271886742-f049cd451bba"],
  ["Кола", "Ундаа", 3500, "photo-1622483767028-3f66f32aef97"],
  ["Газтай ус", "Ундаа", 3200, "photo-1606168094336-48f2056f095e"],
  ["Энергийн ундаа", "Ундаа", 6500, "photo-1622543925917-763c34d1a86e"],
  ["Lays chips", "Амттан", 8800, "photo-1566478989037-eec170784d0b"],
  ["Maxfun", "Амттан", 9900, "photo-1549007994-cb92caebd54b"],
  ["Snickers", "Амттан", 4400, "photo-1621939514649-280e2ee25f60"],
  ["Жигнэмэг", "Амттан", 6900, "photo-1558961363-fa8fdf82db35"],
  ["Чихэр", "Амттан", 5900, "photo-1582058091505-f87a2e55a40f"],
  ["Зайрмаг", "Амттан", 4300, "photo-1501443762994-82bd5dace89a"],
  ["Салат", "Бэлэн хоол", 8900, "photo-1540420773420-3366772f4999"],
  ["Сэндвич", "Бэлэн хоол", 7900, "photo-1528735602780-2552fd46c7af"],
  ["Кимбап", "Бэлэн хоол", 10500, "photo-1617196034796-73dfa7b1fd56"],
  ["Рамен", "Бэлэн хоол", 5900, "photo-1569718212165-3a8278d5f624"],
  ["Хөлдөөсөн бууз", "Хөлдөөсөн", 16800, "photo-1496116218417-1a781b1c416c"],
  ["Хөлдөөсөн банш", "Хөлдөөсөн", 14900, "photo-1563245372-f21724e3856d"],
  ["Загас", "Хөлдөөсөн", 19600, "photo-1519708227418-c8fd9a32b7a2"],
  ["Самар", "Амттан", 11500, "photo-1508061253366-f7da158b6d46"],
  ["Үзэм", "Амттан", 7700, "photo-1596591868231-05e9081526a4"],
  ["Зөгийн бал", "Хүнс", 22000, "photo-1587049352846-4a222e784d38"],
  ["Овьёос", "Хүнс", 8400, "photo-1614961233913-a5113a4a34ed"],
  ["Corn flakes", "Хүнс", 13500, "photo-1521483451569-e33803c0330c"],
  ["Нойтон салфетка", "Ахуй", 5100, "photo-1583947581924-860bda6a26df"],
  ["Ариун цэврийн цаас", "Ахуй", 14200, "photo-1584556812952-905ffd0c611a"],
  ["Угаалгын нунтаг", "Ахуй", 18900, "photo-1585421514284-efb74c2b69ba"],
  ["Аяга таваг угаагч", "Ахуй", 8800, "photo-1584464491033-06628f3a6b7b"],
  ["Шампунь", "Ахуй", 12700, "photo-1522338242992-e1a54906a8da"],
  ["Саван", "Ахуй", 3100, "photo-1607006483224-2a0f0f0f6b8f"],
  ["Гар ариутгагч", "Эрүүл мэнд", 5900, "photo-1584744982491-665216d95f8b"],
  ["Маск 50ш", "Эрүүл мэнд", 9900, "photo-1584634731339-252c581abfc5"],
  ["Витамин C", "Эрүүл мэнд", 16500, "photo-1584308666744-24d5c474f2ae"],
];

const nominFeaturedProductOrder = [
  "Lays chips",
  "Maxfun",
  "Snickers",
  "Жигнэмэг",
  "Чихэр",
  "Зайрмаг",
  "Кола",
  "Газтай ус",
  "Энергийн ундаа",
  "Minute Maid",
  "Кофе",
  "Ногоон цай",
  "Ус",
  "Йогурт",
  "Самар",
  "Үзэм",
  "Зөгийн бал",
  "Сүү",
  "Corn flakes",
];

const nominFeaturedImageByName = new Map([
  ["Maxfun", "https://tse4.mm.bing.net/th?q=Alpen%20Gold%20Max%20Fun%20chocolate%20160g%20product&w=1000&h=650&c=7&rs=1&p=0"],
  ["Lays chips", "https://tse4.mm.bing.net/th?q=Lay%27s%20Masala%20chips%20bag%20product&w=1000&h=650&c=7&rs=1&p=0"],
  ["Snickers", "https://tse4.mm.bing.net/th?q=Snickers%20chocolate%20bar%20product&w=1000&h=650&c=7&rs=1&p=0"],
  ["Жигнэмэг", "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1000&q=92"],
  ["Чихэр", "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?auto=format&fit=crop&w=1000&q=92"],
  ["Зайрмаг", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=1000&q=92"],
  ["Кола", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1000&q=92"],
  ["Газтай ус", "https://tse4.mm.bing.net/th?q=sparkling%20water%20bottle%20product%20photo&w=1000&h=650&c=7&rs=1&p=0"],
  ["Энергийн ундаа", "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=1000&q=92"],
  ["Minute Maid", "https://tse4.mm.bing.net/th?q=Minute%20Maid%201.25L%20juice%20bottle%20product&w=1000&h=650&c=7&rs=1&p=0"],
  ["Кофе", "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1000&q=92"],
  ["Ногоон цай", "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=1000&q=92"],
  ["Ус", "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1000&q=92"],
  ["Йогурт", "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1000&q=92"],
  ["Самар", "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=1000&q=92"],
  ["Үзэм", "https://tse4.mm.bing.net/th?q=raisins%20package%20product%20photo&w=1000&h=650&c=7&rs=1&p=0"],
  ["Зөгийн бал", "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1000&q=92"],
  ["Сүү", "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=1000&q=92"],
  ["Corn flakes", "https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=1000&q=92"],
]);

function nominProductRank(name: string, category: string) {
  const nameRank = nominFeaturedProductOrder.findIndex((keyword) => name.includes(keyword));
  if (nameRank >= 0) return nameRank;
  const categoryRank = ["Амттан", "Ундаа", "Сүү"].findIndex((keyword) => category.includes(keyword));
  return categoryRank >= 0 ? nominFeaturedProductOrder.length + categoryRank : 100;
}

function nominProductImage(name: string, fallbackImageId: string) {
  const featuredImage = [...nominFeaturedImageByName.entries()].find(([keyword]) => name.includes(keyword))?.[1];
  return featuredImage ?? `${imageBase}/${fallbackImageId}?auto=format&fit=crop&w=1000&q=86`;
}

export const nominCatalogProducts: NominCatalogProduct[] = nominCatalogRows.map(([name, category, priceMnt, imageId], index) => ({
  name,
  sku: `NM-${String(index + 1).padStart(4, "0")}`,
  category,
  priceMnt,
  weightGrams: 180 + (index % 12) * 150,
  stockCount: index % 17 === 0 ? 0 : 8 + ((index * 7) % 68),
  description: `Номин Супермаркет - ${category.toLowerCase()} ангиллын баталгаатай бараа.`,
  imageUrl: nominProductImage(name, imageId),
})).sort((first, second) => (
  nominProductRank(first.name, first.category) - nominProductRank(second.name, second.category)
  || second.priceMnt - first.priceMnt
));
