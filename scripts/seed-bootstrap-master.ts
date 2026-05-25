import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

export const bootstrapCategories = [
  { name: "Fashion", nameTh: "แฟชั่น", nameEn: "Fashion", slug: "fashion", sortOrder: 10 },
  { name: "Beauty", nameTh: "ความงาม", nameEn: "Beauty", slug: "beauty", sortOrder: 20 },
  { name: "Gadgets", nameTh: "แกดเจ็ต", nameEn: "Gadgets", slug: "gadgets", sortOrder: 30 },
  { name: "Electronics", nameTh: "อิเล็กทรอนิกส์", nameEn: "Electronics", slug: "electronics", sortOrder: 40 },
  { name: "Home", nameTh: "บ้าน", nameEn: "Home", slug: "home", sortOrder: 50 },
  { name: "Sports", nameTh: "กีฬา", nameEn: "Sports", slug: "sports", sortOrder: 60 },
  { name: "Kids", nameTh: "เด็ก", nameEn: "Kids", slug: "kids", sortOrder: 70 },
  { name: "Groceries", nameTh: "ของใช้ประจำวัน", nameEn: "Groceries", slug: "groceries", sortOrder: 80 },
  { name: "Pets", nameTh: "สัตว์เลี้ยง", nameEn: "Pets", slug: "pets", sortOrder: 90 },
  { name: "Deals", nameTh: "ดีล", nameEn: "Deals", slug: "deals", sortOrder: 100 },
  { name: "Books", nameTh: "หนังสือ", nameEn: "Books", slug: "books", sortOrder: 110 },
] as const;

export const bootstrapBrands = [
  {
    name: "Sming Basics",
    nameTh: "สมิง เบสิกส์",
    nameEn: "Sming Basics",
    slug: "sming-basics",
    code: "SMING-BASICS",
    description: "Everyday essentials for local marketplace shoppers.",
    descriptionTh: "สินค้าเบสิกใช้ได้ทุกวันสำหรับนักช้อปในประเทศ",
    descriptionEn: "Everyday essentials for local marketplace shoppers.",
    logoUrl: "https://example.com/demo/brands/sming-basics.svg",
    websiteUrl: "https://example.com/brands/sming-basics",
    countryCode: "TH",
    sortOrder: 10,
    isFeatured: true,
  },
  {
    name: "Urban Thread",
    nameTh: "เออร์เบิน เธรด",
    nameEn: "Urban Thread",
    slug: "urban-thread",
    code: "URBAN-THREAD",
    description: "Streetwear and casual apparel with relaxed fits.",
    descriptionTh: "สตรีตแวร์และเสื้อผ้าลำลองทรงใส่ง่าย",
    descriptionEn: "Streetwear and casual apparel with relaxed fits.",
    logoUrl: "https://example.com/demo/brands/urban-thread.svg",
    websiteUrl: "https://example.com/brands/urban-thread",
    countryCode: "TH",
    sortOrder: 20,
    isFeatured: true,
  },
  {
    name: "Gadget Harbor",
    nameTh: "แกดเจ็ต ฮาร์เบอร์",
    nameEn: "Gadget Harbor",
    slug: "gadget-harbor",
    code: "GADGET-HARBOR",
    description: "Practical mobile accessories and compact electronics.",
    descriptionTh: "อุปกรณ์มือถือและอิเล็กทรอนิกส์ขนาดกะทัดรัด",
    descriptionEn: "Practical mobile accessories and compact electronics.",
    logoUrl: "https://example.com/demo/brands/gadget-harbor.svg",
    websiteUrl: "https://example.com/brands/gadget-harbor",
    countryCode: "SG",
    sortOrder: 30,
    isFeatured: true,
  },
  {
    name: "Nest & Glow",
    nameTh: "เนสต์ แอนด์ โกลว์",
    nameEn: "Nest & Glow",
    slug: "nest-glow",
    code: "NEST-GLOW",
    description: "Home, beauty, and lifestyle goods for warm daily routines.",
    descriptionTh: "สินค้าไลฟ์สไตล์ บ้าน และความงามสำหรับทุกวัน",
    descriptionEn: "Home, beauty, and lifestyle goods for warm daily routines.",
    logoUrl: "https://example.com/demo/brands/nest-glow.svg",
    websiteUrl: "https://example.com/brands/nest-glow",
    countryCode: "TH",
    sortOrder: 40,
    isFeatured: false,
  },
] as const;

export function validateBootstrapMasterSeedData() {
  const categorySlugs = new Set<string>();
  for (const category of bootstrapCategories) {
    if (categorySlugs.has(category.slug)) throw new Error(`Duplicate bootstrap category slug ${category.slug}`);
    categorySlugs.add(category.slug);
  }

  const brandSlugs = new Set<string>();
  const brandCodes = new Set<string>();
  for (const brand of bootstrapBrands) {
    if (brandSlugs.has(brand.slug)) throw new Error(`Duplicate bootstrap brand slug ${brand.slug}`);
    if (brandCodes.has(brand.code)) throw new Error(`Duplicate bootstrap brand code ${brand.code}`);
    brandSlugs.add(brand.slug);
    brandCodes.add(brand.code);
  }
}

export async function seedBootstrapMasterData() {
  validateBootstrapMasterSeedData();
  loadEnvLocal();
  const { prisma } = await import("#server/lib/prisma.ts");

  for (const categorySeed of bootstrapCategories) {
    await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: {
        name: categorySeed.name,
        nameTh: categorySeed.nameTh,
        nameEn: categorySeed.nameEn,
        sortOrder: categorySeed.sortOrder,
        isActive: true,
      },
      create: {
        ...categorySeed,
        isActive: true,
      },
    });
  }

  for (const brandSeed of bootstrapBrands) {
    await prisma.brand.upsert({
      where: { slug: brandSeed.slug },
      update: {
        name: brandSeed.name,
        nameTh: brandSeed.nameTh,
        nameEn: brandSeed.nameEn,
        code: brandSeed.code,
        description: brandSeed.description,
        descriptionTh: brandSeed.descriptionTh,
        descriptionEn: brandSeed.descriptionEn,
        logoUrl: brandSeed.logoUrl,
        websiteUrl: brandSeed.websiteUrl,
        countryCode: brandSeed.countryCode,
        sortOrder: brandSeed.sortOrder,
        isFeatured: brandSeed.isFeatured,
        isActive: true,
      },
      create: {
        ...brandSeed,
        isActive: true,
      },
    });
  }
}

if (process.argv[1]?.endsWith("seed-bootstrap-master.ts")) {
  seedBootstrapMasterData()
    .then(() => {
      console.log(`Seeded bootstrap master data: categories=${bootstrapCategories.length} brands=${bootstrapBrands.length}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const { prisma } = await import("#server/lib/prisma.ts");
      await prisma.$disconnect();
    });
}
