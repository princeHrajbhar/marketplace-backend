// src/seed.ts
/**
 * ─── Database Seeder ──────────────────────────────────────────────────────────
 * Populates the database with:
 *   - 1 Admin user
 *   - 1 Regular user
 *   - 10 Sample products
 *
 * Run with: npm run seed
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from './models/User';
import { Product } from './models/Product';
import { RefreshToken } from './models/RefreshToken';
import { Otp } from './models/Otp';
import { UserRole } from './types';
import { logger } from './utils/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/marketplace_v2';

// ─── Seed Data ─────────────────────────────────────────────────────────────────

const users = [
  {
    name: 'Admin User',
    email: 'admin@marketplace.com',
    password: 'Admin@1234',
    role: UserRole.ADMIN,
    isVerified: true,
    isActive: true,
  },
  {
    name: 'John Doe',
    email: 'john@marketplace.com',
    password: 'User@1234',
    role: UserRole.USER,
    isVerified: true,
    isActive: true,
  },
];

const products = [
  {
    title: 'iPhone 15 Pro Max',
    price: 1199.99,
    description:
      'Apple flagship with A17 Pro chip, 48MP camera system, titanium design, and USB-C connectivity. Up to 29 hours video playback.',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80',
  },
  {
    title: 'Samsung Galaxy S24 Ultra',
    price: 1099.99,
    description:
      'Samsung flagship with integrated S Pen, 200MP quad camera, Snapdragon 8 Gen 3, and Galaxy AI features.',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80',
  },
  {
    title: 'Apple MacBook Pro 14" M3',
    price: 1999.99,
    description:
      'Powered by M3 Pro chip, Liquid Retina XDR display, up to 18 hours battery. Perfect for professionals.',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
  },
  {
    title: 'Sony WH-1000XM5 Headphones',
    price: 349.99,
    description:
      'Industry-leading noise cancellation, 30-hour battery, multipoint connection, and crystal-clear call quality.',
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80',
  },
  {
    title: 'Dell XPS 15 (2024)',
    price: 1549.99,
    description:
      'Intel Core i9 processor, OLED display, NVIDIA RTX 4070 GPU — the ultimate Windows laptop for creators.',
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80',
  },
  {
    title: 'Apple iPad Pro 12.9" M2',
    price: 1099.99,
    description:
      'Liquid Retina XDR display with ProMotion, M2 chip, Thunderbolt / USB 4 port, Wi-Fi 6E.',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
  },
  {
    title: 'Nike Air Jordan 1 Retro High',
    price: 179.99,
    description:
      'Classic basketball shoe with premium full-grain leather upper, Nike Air cushioning unit, iconic silhouette.',
    image: 'https://images.unsplash.com/photo-1556906781-9a412961d28c?w=800&q=80',
  },
  {
    title: 'Dyson V15 Detect Absolute',
    price: 749.99,
    description:
      'Laser dust detection, HEPA filtration system, up to 60 minutes runtime. Certified asthma & allergy friendly.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  },
  {
    title: 'Logitech MX Master 3S',
    price: 99.99,
    description:
      'Ergonomic wireless mouse with MagSpeed electromagnetic scroll wheel, 8K DPI sensor, multi-device support.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
  },
  {
    title: 'Bose QuietComfort Ultra',
    price: 429.99,
    description:
      'Bose Immersive Audio, world-class noise cancellation, 24-hour battery, premium comfort for long listening sessions.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
  },
];

// ─── Seeder ────────────────────────────────────────────────────────────────────

const seed = async (): Promise<void> => {
  try {
    logger.info('🌱 Starting database seed...');
    await mongoose.connect(MONGO_URI);
    logger.info('✅ Connected to MongoDB');

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      RefreshToken.deleteMany({}),
      Otp.deleteMany({}),
    ]);
    logger.info('🗑️  Cleared existing data');

    // Seed users
    const createdUsers = await User.create(users);
    const adminUser = createdUsers.find((u) => u.role === UserRole.ADMIN)!;
    logger.info(`👤 Created ${createdUsers.length} users`);

    // Seed products (admin as creator)
    await Product.create(
      products.map((p) => ({ ...p, createdBy: adminUser._id, isActive: true }))
    );
    logger.info(`📦 Created ${products.length} products`);

    // Print credentials
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                   🌱 SEED COMPLETE! 🎉                    ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('  👑 ADMIN');
    console.log('     Email    : admin@marketplace.com');
    console.log('     Password : Admin@1234');
    console.log('');
    console.log('  👤 USER');
    console.log('     Email    : john@marketplace.com');
    console.log('     Password : User@1234');
    console.log('');
    console.log(`  📦 PRODUCTS : ${products.length} seeded`);
    console.log('');
    console.log('  🚀 Start server: npm run dev');
    console.log('  📡 API Base   : http://localhost:5000/api/v1');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  } catch (error) {
    logger.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seed();
