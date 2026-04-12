import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcryptjs'

// Block seeder from running in production
if (process.env.NODE_ENV === 'production') {
  console.error('SEEDER BLOCKED: Cannot run seed in production environment.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  
  const passwordHash = await bcrypt.hash('password123', 12)

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lawfinder.lk' },
    update: {},
    create: {
      email: 'admin@lawfinder.lk',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // 2. Create Lawyer
  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@lawfinder.lk' },
    update: {},
    create: {
      email: 'lawyer@lawfinder.lk',
      passwordHash,
      role: 'LAWYER',
      profile: {
        create: {
          fullName: 'Kavindu Perera',
          baslNumber: 'BASL-2024-0451',
          isVerified: true,
          bio: 'Senior attorney with over 15 years of experience in property and family law across the Colombo district. Fluent in all three national languages.',
          practiceAreas: ['Family Law', 'Property Law', 'Civil Law'],
          languages: ['Sinhala', 'Tamil', 'English'],
          district: 'Colombo',
          baseFeeRange: 'LKR 5,000 - 15,000',
        },
      },
    },
  })

  // 3. Create Client
  const client = await prisma.user.upsert({
    where: { email: 'citizen@lawfinder.lk' },
    update: {},
    create: {
      email: 'citizen@lawfinder.lk',
      passwordHash,
      role: 'CLIENT',
    },
  })

  // 3.5 Create Second Lawyer (With Subscription intended)
  const lawyer2 = await prisma.user.upsert({
    where: { email: 'lawyer2@lawfinder.lk' },
    update: {},
    create: {
      email: 'lawyer2@lawfinder.lk',
      passwordHash,
      role: 'LAWYER',
      profile: {
        create: {
          fullName: 'Nuwan Senanayake',
          baslNumber: 'BASL-2024-0899',
          isVerified: true,
          bio: 'Corporate Law specialist focusing on business registrations and mergers.',
          practiceAreas: ['Corporate Law', 'Commercial Law'],
          languages: ['English', 'Sinhala'],
          district: 'Kandy',
          baseFeeRange: 'LKR 10,000 - 25,000',
        },
      },
    },
  })

  // 4. Seed Subscription Roles
  console.log('Creating subscription tiers...')
  
  const basicRole = await prisma.subscriptionRole.upsert({
    where: { name: 'BASIC' },
    update: {},
    create: {
      name: 'BASIC',
      description: 'Basic subscription tier for new lawyers',
    },
  })

  const professionalRole = await prisma.subscriptionRole.upsert({
    where: { name: 'PROFESSIONAL' },
    update: {},
    create: {
      name: 'PROFESSIONAL',
      description: 'Professional subscription tier with enhanced features',
    },
  })

  const premiumRole = await prisma.subscriptionRole.upsert({
    where: { name: 'PREMIUM' },
    update: {},
    create: {
      name: 'PREMIUM',
      description: 'Premium tier with advanced analytics and priority support',
    },
  })

  const enterpriseRole = await prisma.subscriptionRole.upsert({
    where: { name: 'ENTERPRISE' },
    update: {},
    create: {
      name: 'ENTERPRISE',
      description: 'Enterprise tier with unlimited features and dedicated support',
    },
  })

  // 5. Seed Permissions
  console.log('Creating permissions...')
  
  const permissionsData = [
    // Article Permissions
    { name: 'create_article', slug: 'create-article', category: 'articles', description: 'Create new articles' },
    { name: 'edit_article', slug: 'edit-article', category: 'articles', description: 'Edit own articles' },
    { name: 'delete_article', slug: 'delete-article', category: 'articles', description: 'Delete articles' },
    { name: 'publish_article', slug: 'publish-article', category: 'articles', description: 'Publish articles' },
    
    // Inquiry Permissions
    { name: 'receive_inquiries', slug: 'receive-inquiries', category: 'inquiries', description: 'Receive client inquiries' },
    { name: 'post_inquiry', slug: 'post-inquiry', category: 'inquiries', description: 'Post inquiries to clients' },
    { name: 'manage_inquiries', slug: 'manage-inquiries', category: 'inquiries', description: 'Manage all inquiries' },
    
    // Chat Permissions
    { name: 'access_chat', slug: 'access-chat', category: 'chat', description: 'Access chat functionality' },
    { name: 'send_message', slug: 'send-message', category: 'chat', description: 'Send messages' },
    
    // Profile Permissions
    { name: 'edit_profile', slug: 'edit-profile', category: 'profile', description: 'Edit profile information' },
    { name: 'upload_documents', slug: 'upload-documents', category: 'profile', description: 'Upload identity documents' },
    
    // Promotion Permissions
    { name: 'access_paid_promo', slug: 'access-paid-promo', category: 'promotion', description: 'Access paid promotion features' },
    { name: 'create_promo', slug: 'create-promo', category: 'promotion', description: 'Create promotional campaigns' },
    
    // Analytics Permissions
    { name: 'view_analytics', slug: 'view-analytics', category: 'analytics', description: 'View analytics and statistics' },
    { name: 'export_data', slug: 'export-data', category: 'analytics', description: 'Export data reports' },
  ]

  const permissions = await Promise.all(
    permissionsData.map((perm) =>
      prisma.permission.upsert({
        where: { slug: perm.slug },
        update: {},
        create: perm,
      })
    )
  )

  // 6. Assign Permissions to Roles
  console.log('Assigning permissions to roles...')
  
  // BASIC: Limited permissions
  const basicPermissions = [
    'create_article',
    'receive_inquiries',
    'access_chat',
    'send_message',
    'edit_profile',
  ]

  // PROFESSIONAL: More permissions
  const professionalPermissions = [
    ...basicPermissions,
    'edit_article',
    'publish_article',
    'post_inquiry',
    'view_analytics',
    'upload_documents',
  ]

  // PREMIUM: Advanced permissions
  const premiumPermissions = [
    ...professionalPermissions,
    'delete_article',
    'manage_inquiries',
    'access_paid_promo',
    'create_promo',
    'export_data',
  ]

  // ENTERPRISE: All permissions
  const enterprisePermissions = permissionsData.map((p) => p.slug)

  const rolePermissionMap = [
    { role: basicRole, slugs: basicPermissions },
    { role: professionalRole, slugs: professionalPermissions },
    { role: premiumRole, slugs: premiumPermissions },
    { role: enterpriseRole, slugs: enterprisePermissions },
  ]

  for (const { role, slugs } of rolePermissionMap) {
    for (const slug of slugs) {
      const permission = permissions.find((p) => p.slug === slug)
      if (permission) {
        await prisma.subscriptionRolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        })
      }
    }
  }

  // 6.5 Seed 3 Subscription Plans
  console.log('Creating subscription plans...')
  
  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan_basic_1' }, // we can use an arbitrary unique ID field if we don't have a unique name
    update: {
      name: 'Basic Plan',
      tier: 'BASIC',
      monthlyAmount: 0,
      yearlyAmount: 0,
    },
    create: {
      id: 'plan_basic_1',
      name: 'Basic Plan',
      tier: 'BASIC',
      monthlyAmount: 0,
      yearlyAmount: 0,
    }
  })

  // We can't actually do where: { id: 'xxx' } if the model uses `id String @id @default(uuid())` without adding a fixed ID in string, which is fine.
  
  const professionalPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan_prof_1' },
    update: {
      name: 'Professional Plan',
      tier: 'PROFESSIONAL',
      monthlyAmount: 5000,
      yearlyAmount: 50000,
    },
    create: {
      id: 'plan_prof_1',
      name: 'Professional Plan',
      tier: 'PROFESSIONAL',
      monthlyAmount: 5000,
      yearlyAmount: 50000,
    }
  })

  const premiumPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan_prem_1' },
    update: {
      name: 'Premium Plan',
      tier: 'PREMIUM',
      monthlyAmount: 10000,
      yearlyAmount: 100000,
    },
    create: {
      id: 'plan_prem_1',
      name: 'Premium Plan',
      tier: 'PREMIUM',
      monthlyAmount: 10000,
      yearlyAmount: 100000,
    }
  });

  // Assign lawyer2 a subscription
  console.log('Assigning Premium subscription to second lawyer...')
  
  // We need to fetch the lawyerProfile ID for lawyer2
  const lawyer2Profile = await prisma.lawyerProfile.findUnique({
    where: { userId: lawyer2.id }
  })
  
  if (lawyer2Profile) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { lawyerId: lawyer2Profile.id }
    })
    
    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          lawyerId: lawyer2Profile.id,
          planId: premiumPlan.id,
          roleId: premiumRole.id,
          status: 'ACTIVE',
          billingCycle: 'YEARLY',
          startDate: new Date(),
          nextBilling: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        }
      })
    }
  }

  // 7. Seed Features for usage tracking
  console.log('Creating features...')
  
  const featuresData = [
    { name: 'articles_per_month', slug: 'articles-per-month', unit: 'count', description: 'Number of articles per month' },
    { name: 'inquiries_per_month', slug: 'inquiries-per-month', unit: 'count', description: 'Number of inquiries per month' },
    { name: 'chat_messages_per_month', slug: 'chat-messages-per-month', unit: 'count', description: 'Number of chat messages per month' },
    { name: 'promo_campaigns_per_month', slug: 'promo-campaigns-per-month', unit: 'count', description: 'Number of promo campaigns per month' },
    { name: 'storage_gb', slug: 'storage-gb', unit: 'GB', description: 'Storage in GB' },
  ]

  const features = await Promise.all(
    featuresData.map((feat) =>
      prisma.feature.upsert({
        where: { slug: feat.slug },
        update: {},
        create: feat,
      })
    )
  )

  // 8. Seed Feature Limits for each role
  console.log('Setting feature limits...')
  
  const featureLimits = [
    // BASIC limits
    { role: basicRole, limits: { articles_per_month: 2, inquiries_per_month: 10, chat_messages_per_month: 50, promo_campaigns_per_month: 0, storage_gb: 1 } },
    
    // PROFESSIONAL limits
    { role: professionalRole, limits: { articles_per_month: 10, inquiries_per_month: 50, chat_messages_per_month: 500, promo_campaigns_per_month: 2, storage_gb: 5 } },
    
    // PREMIUM limits
    { role: premiumRole, limits: { articles_per_month: 50, inquiries_per_month: 200, chat_messages_per_month: 2000, promo_campaigns_per_month: 10, storage_gb: 20 } },
    
    // ENTERPRISE limits (-1 = unlimited)
    { role: enterpriseRole, limits: { articles_per_month: -1, inquiries_per_month: -1, chat_messages_per_month: -1, promo_campaigns_per_month: -1, storage_gb: -1 } },
  ]

  for (const { role, limits } of featureLimits) {
    for (const [featureName, limit] of Object.entries(limits)) {
      await prisma.featureLimitConfig.upsert({
        where: { roleId_featureName: { roleId: role.id, featureName } },
        update: { limit },
        create: {
          roleId: role.id,
          featureName,
          limit,
        },
      })
    }
  }

  console.log('-------------------------------------------')
  console.log('Database seeded successfully.')
  console.log('Login Credentials (Password for all: password123):')
  console.log(`  Admin:  ${admin.email}`)
  console.log(`  Lawyer: ${lawyer.email}`)
  console.log(`  Client: ${client.email}`)
  console.log('-------------------------------------------')
  console.log('Seeded subscription tiers: BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE')
  console.log(`Created ${permissions.length} permissions`)
  console.log('Set up feature limits for all roles')
  console.log('-------------------------------------------')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
