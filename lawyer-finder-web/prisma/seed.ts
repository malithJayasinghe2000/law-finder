import { PrismaClient } from '@prisma/client'
import { ensureAttorneyHasFirm } from '../src/lib/firms/provisioning'
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
    where: { email: 'admin@thelawyr.lk' },
    update: {},
    create: {
      email: 'admin@thelawyr.lk',
      passwordHash,
      role: 'ADMIN',
    },
  })

  // 2. Create Lawyer
  const existingProfile1 = await prisma.lawyerProfile.findUnique({
    where: { baslNumber: 'BASL-2024-0451' },
  });

  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@thelawyr.lk' },
    update: {},
    create: {
      email: 'lawyer@thelawyr.lk',
      passwordHash,
      role: 'LAWYER',
      profile: existingProfile1 ? undefined : {
        create: {
          fullName: 'Kavindu Perera',
          baslNumber: 'BASL-2024-0451',
          isVerified: true,
          bio: 'Senior attorney with over 15 years of experience in property and family law across the Colombo district. Fluent in all three national languages.',
          practiceAreas: ['Family Law', 'Property Law', 'Civil Law'],
          languages: ['Sinhala', 'Tamil', 'English'],
          district: 'Colombo',
        },
      },
    },
  })

  // 3. Create Client
  const client = await prisma.user.upsert({
    where: { email: 'citizen@thelawyr.lk' },
    update: {},
    create: {
      email: 'citizen@thelawyr.lk',
      passwordHash,
      role: 'CLIENT',
    },
  })

  // 3.5 Create Second Lawyer (With Subscription intended)
  const existingProfile2 = await prisma.lawyerProfile.findUnique({
    where: { baslNumber: 'BASL-2024-0899' },
  });

  const lawyer2 = await prisma.user.upsert({
    where: { email: 'lawyer2@thelawyr.lk' },
    update: {},
    create: {
      email: 'lawyer2@thelawyr.lk',
      passwordHash,
      role: 'LAWYER',
      profile: existingProfile2 ? undefined : {
        create: {
          fullName: 'Nuwan Senanayake',
          baslNumber: 'BASL-2024-0899',
          isVerified: true,
          bio: 'Corporate Law specialist focusing on business registrations and mergers.',
          practiceAreas: ['Corporate Law', 'Commercial Law'],
          languages: ['English', 'Sinhala'],
          district: 'Kandy',
        },
      },
    },
  })

  // 3.6 Create Third Lawyer (Criminal Law)
  const existingProfile3 = await prisma.lawyerProfile.findUnique({
    where: { baslNumber: 'BASL-2024-1102' },
  });

  const lawyer3 = await prisma.user.upsert({
    where: { email: 'lawyer3@thelawyr.lk' },
    update: {},
    create: {
      email: 'lawyer3@thelawyr.lk',
      passwordHash,
      role: 'LAWYER',
      profile: existingProfile3 ? undefined : {
        create: {
          fullName: 'Anura Bandara',
          baslNumber: 'BASL-2024-1102',
          isVerified: true,
          bio: 'Expert in Criminal Law with 10 years of courtroom experience.',
          practiceAreas: ['Criminal Law'],
          languages: ['Sinhala', 'English'],
          district: 'Colombo',
        },
      },
    },
  })

  // 3.7 Create Fourth Lawyer (Employment & Civil Litigation)
  const existingProfile4 = await prisma.lawyerProfile.findUnique({
    where: { baslNumber: 'BASL-2024-2204' },
  });

  const lawyer4 = await prisma.user.upsert({
    where: { email: 'lawyer4@thelawyr.lk' },
    update: {},
    create: {
      email: 'lawyer4@thelawyr.lk',
      passwordHash,
      role: 'LAWYER',
      profile: existingProfile4 ? undefined : {
        create: {
          fullName: 'Nethmi Wijesinghe',
          baslNumber: 'BASL-2024-2204',
          isVerified: true,
          bio: 'Specialist in labor disputes, employment contracts, and general civil litigation.',
          practiceAreas: ['Employment Law', 'Civil Litigation'],
          languages: ['Sinhala', 'English', 'Tamil'],
          district: 'Galle',
        },
      },
    },
  })

  // 3.8 Create Fifth Lawyer (Real Estate & Property)
  const existingProfile5 = await prisma.lawyerProfile.findUnique({
    where: { baslNumber: 'BASL-2024-3315' },
  });

  const lawyer5 = await prisma.user.upsert({
    where: { email: 'lawyer5@thelawyr.lk' },
    update: {},
    create: {
      email: 'lawyer5@thelawyr.lk',
      passwordHash,
      role: 'LAWYER',
      profile: existingProfile5 ? undefined : {
        create: {
          fullName: 'Mohammed Roshan',
          baslNumber: 'BASL-2024-3315',
          isVerified: true,
          bio: 'Notary Public and Real Estate lawyer handling deeds, titles, and property disputes.',
          practiceAreas: ['Real Estate', 'Property Law'],
          languages: ['Tamil', 'English'],
          district: 'Colombo',
        },
      },
    },
  })

  // 3.9 Give every seeded attorney a firm of one.
  //
  // Since Phase 2 the FIRM is the provider of legal services, so an attorney
  // must never exist on the system without one. This mirrors what
  // api/applications/[id]/approve does on real approval, and what the
  // 20260801210442_law_firm_entity migration did for existing data.
  // See docs/restructure/LEGAL-GUARDRAILS.md (rule 7).
  console.log('Provisioning firms for seeded attorneys...')

  const seededProfiles = await prisma.lawyerProfile.findMany({
    where: { firmId: null },
    select: { id: true },
  })

  for (const { id } of seededProfiles) {
    await ensureAttorneyHasFirm(prisma, id)
  }

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

  // Licence the second lawyer's FIRM.
  //
  // A subscription belongs to a LawFirm, not to a LawyerProfile (Phase 3): the
  // practice buys the software and its members' access follows from membership.
  console.log("Assigning Premium licence to the second lawyer's firm...")

  const lawyer2Profile = await prisma.lawyerProfile.findUnique({
    where: { userId: lawyer2.id }
  })

  if (lawyer2Profile?.firmId) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { firmId: lawyer2Profile.firmId }
    })
    
    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          firmId: lawyer2Profile.firmId,
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

  // Licence the remaining test firms.
  //
  // The old comment here said these existed "so they appear in RAG
  // recommendations" — subscription status has never been allowed to affect
  // whether a practitioner is shown to a client (guardrail rules 3 and 4), and
  // since Phase 5 the assistant surfaces no practitioners at all. They are
  // licensed simply so the dev data has firms on a plan.
  const testLawyers = [lawyer3, lawyer4, lawyer5];
  for (const tLawyer of testLawyers) {
    const profile = await prisma.lawyerProfile.findUnique({ where: { userId: tLawyer.id } });
    if (profile?.firmId) {
      const exists = await prisma.subscription.findFirst({ where: { firmId: profile.firmId } });
      if (!exists) {
        await prisma.subscription.create({
          data: {
            firmId: profile.firmId,
            planId: professionalPlan.id,
            roleId: professionalRole.id,
            status: 'ACTIVE',
            billingCycle: 'YEARLY',
            startDate: new Date(),
            nextBilling: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          }
        });
      }
    }
  }

  // 7. Seed Features for usage tracking
  console.log('Creating features...')
  
  // WHAT MAY BE METERED, AND WHAT MAY NOT
  //
  // Price on seats and software capability. Never on how much legal work flows
  // through the platform.
  //
  // Removed in Phase 2.5, and not to be reintroduced under any name:
  //   inquiries_per_month       — selling a lawyer more clients is pay-per-lead
  //   chat_messages_per_month   — charging for the connection to a client
  //   promo_campaigns_per_month — selling an attorney visibility
  //
  // Those three made revenue rise with the amount of legal work a firm did,
  // which is fee-sharing wearing a subscription tier as a disguise, and they
  // were advertised on the public pricing page.
  // See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 3).
  const featuresData = [
    { name: 'firm_seats', slug: 'firm-seats', unit: 'count', description: 'People at the firm who can sign in' },
    { name: 'storage_gb', slug: 'storage-gb', unit: 'GB', description: 'Document storage' },
    { name: 'articles_per_month', slug: 'articles-per-month', unit: 'count', description: 'Articles the firm may publish per month' },
    { name: 'document_templates', slug: 'document-templates', unit: 'count', description: 'Document automation templates' },
    { name: 'ai_research_queries_per_month', slug: 'ai-research-queries-per-month', unit: 'count', description: 'AI legal research queries (software capability, not client volume)' },
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
  
  // Tiers differ on how many people use the software and what it can do —
  // never on how many clients reach the firm through it.
  const featureLimits = [
    // BASIC — a sole practitioner
    { role: basicRole, limits: { firm_seats: 1, storage_gb: 5, articles_per_month: 2, document_templates: 5, ai_research_queries_per_month: 50 } },

    // PROFESSIONAL — a small practice
    { role: professionalRole, limits: { firm_seats: 5, storage_gb: 50, articles_per_month: 10, document_templates: 25, ai_research_queries_per_month: 300 } },

    // PREMIUM — an established firm
    { role: premiumRole, limits: { firm_seats: 20, storage_gb: 250, articles_per_month: 50, document_templates: 100, ai_research_queries_per_month: 1500 } },

    // ENTERPRISE (-1 = unlimited)
    { role: enterpriseRole, limits: { firm_seats: -1, storage_gb: -1, articles_per_month: -1, document_templates: -1, ai_research_queries_per_month: -1 } },
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

  // ============= COMMUNITY HUB SEED DATA =============
  console.log('Creating community hub seed data...')

  const communitiesData = [
    { name: 'family-law', displayName: 'Family Law', description: 'Discussion on marriage, divorce, custody, adoption, and domestic relations under Sri Lankan law.', category: 'civil', icon: '👨‍👩‍👧‍👦', rules: '1. No personal case details\n2. Cite relevant sections of the Marriage Registration Ordinance or Family Law Acts\n3. Distinguish between Kandyan, Tesawalamai, and General law where applicable' },
    { name: 'property-law', displayName: 'Property & Land Law', description: 'Land ownership, deeds, partition actions, landlord-tenant disputes, and real estate transactions in Sri Lanka.', category: 'civil', icon: '🏘️', rules: '1. Reference land registry and survey department regulations\n2. Specify the relevant land registration system\n3. No promoting real estate agents' },
    { name: 'criminal-law', displayName: 'Criminal Law', description: 'Discussion on the Penal Code, Criminal Procedure Code, bail, sentencing, and criminal defense in Sri Lanka.', category: 'criminal', icon: '⚖️', rules: '1. No incitement to criminal activity\n2. Discuss legal principles, not specific ongoing cases\n3. Respect the presumption of innocence' },
    { name: 'labour-law', displayName: 'Labour & Employment Law', description: 'Employment contracts, worker rights, EPF/ETF, termination procedures, and industrial disputes.', category: 'civil', icon: '👷', rules: '1. Reference relevant Labour Acts\n2. Distinguish between BOI and non-BOI establishments\n3. Employee or employer context must be stated' },
    { name: 'commercial-law', displayName: 'Commercial & Business Law', description: 'Company registrations, partnerships, contracts, commercial disputes, and corporate governance.', category: 'commercial', icon: '💼', rules: '1. Reference Companies Act No. 07 of 2007 where applicable\n2. No advertising of business services\n3. Specify whether advice is for sole proprietors, partnerships, or companies' },
    { name: 'motor-traffic', displayName: 'Motor Traffic Law', description: 'Road accidents, motor insurance claims, traffic violations, license issues, and vehicle-related legal matters.', category: 'civil', icon: '🚗', rules: '1. Reference the Motor Traffic Act\n2. Include relevant police station details when discussing procedures\n3. No sharing of police officer identities' },
    { name: 'banking-finance', displayName: 'Banking & Finance Law', description: 'Banking regulations, loan agreements, debt recovery, financial fraud, and Central Bank regulations.', category: 'commercial', icon: '🏦', rules: '1. No sharing of personal financial details\n2. Reference CBSL regulations where applicable\n3. Distinguish between licensed banks and finance companies' },
    { name: 'constitutional-law', displayName: 'Constitutional Law & Fundamental Rights', description: 'Fundamental rights, constitutional interpretation, public interest litigation, and governance matters.', category: 'advisory', icon: '📜', rules: '1. Reference specific Articles of the Constitution\n2. Keep discussions non-partisan\n3. Focus on legal analysis, not political opinion' },
    { name: 'immigration', displayName: 'Immigration & Visa Law', description: 'Visa applications, residency permits, citizenship, deportation, and immigration procedures in Sri Lanka.', category: 'advisory', icon: '✈️', rules: '1. Reference the Immigrants and Emigrants Act\n2. State nationality when asking questions\n3. No promoting immigration agents' },
    { name: 'legal-general', displayName: 'General Legal Discussion', description: 'General discussions about Sri Lankan law, legal news, reforms, and legal education.', category: 'general', icon: '📚', rules: '1. Keep discussions civil and respectful\n2. Share reliable sources for legal news\n3. Beginner questions are welcome' },
  ]

  for (const communityData of communitiesData) {
    const existingCommunity = await prisma.community.findUnique({
      where: { name: communityData.name },
    })

    if (!existingCommunity) {
      const community = await prisma.community.create({
        data: {
          ...communityData,
          createdById: admin.id,
          memberCount: 1,
        },
      })

      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          userId: admin.id,
          role: 'CREATOR',
        },
      })

      console.log(`  Created community: ${communityData.displayName}`)
    } else {
      console.log(`  Community already exists: ${communityData.displayName}`)
    }
  }

  // ============= AD SYSTEM PLACEMENT CONFIGS SEED =============
  console.log('Seeding Ad Placement Configurations...')
  
  const placements = [
    {
      placement: 'HOMEPAGE_BELOW_HERO',
      displayName: 'Homepage — Below Hero Section',
      description: 'Slider banner below the hero, above "The Legal Advisory Is" section',
      pricePerDay: 2000,
      isSlider: true,
      sliderInterval: 3000,
      maxAdsPerSlot: 3,
      recommendedWidth: 1200,
      recommendedHeight: 400,
      allowedAdTypes: ['BANNER_IMAGE', 'PROFILE_CARD'],
    },
    {
      placement: 'CHAT_RIGHT_SIDEBAR',
      displayName: 'AI Chat — Right Sidebar',
      description: 'Right sidebar ads alongside the AI chat interface',
      pricePerDay: 1500,
      isSlider: true,
      sliderInterval: 3000,
      maxAdsPerSlot: 3,
      recommendedWidth: 300,
      recommendedHeight: 250,
      allowedAdTypes: ['SIDEBAR_CARD'],
    },
    {
      placement: 'BLOG_TOP_BANNER',
      displayName: 'Blog — Top Banner',
      description: 'Slider banner above category cards on the blog listing page',
      pricePerDay: 1500,
      isSlider: true,
      sliderInterval: 3000,
      maxAdsPerSlot: 3,
      recommendedWidth: 728,
      recommendedHeight: 90,
      allowedAdTypes: ['BANNER_IMAGE'],
    },
    {
      placement: 'BLOG_RIGHT_SIDEBAR',
      displayName: 'Blog — Right Sidebar (Sticky)',
      description: 'Sticky sidebar ads that stay visible while scrolling blog posts',
      pricePerDay: 1200,
      isSlider: true,
      sliderInterval: 3000,
      maxAdsPerSlot: 5,
      recommendedWidth: 300,
      recommendedHeight: 250,
      allowedAdTypes: ['SIDEBAR_CARD'],
    },
    {
      placement: 'BLOG_BOTTOM_STICKY',
      displayName: 'Blog — Bottom Sticky Bar',
      description: 'Fixed bar at the bottom of the blog page, stays visible while scrolling',
      pricePerDay: 1000,
      isSlider: false,
      sliderInterval: 5000,
      maxAdsPerSlot: 1,
      recommendedWidth: 728,
      recommendedHeight: 90,
      allowedAdTypes: ['STICKY_BAR'],
    },
    {
      placement: 'BLOG_POST_SIDEBAR',
      displayName: 'Blog Post — Right Sidebar',
      description: 'Sidebar ads alongside individual blog post content',
      pricePerDay: 1000,
      isSlider: true,
      sliderInterval: 3000,
      maxAdsPerSlot: 3,
      recommendedWidth: 300,
      recommendedHeight: 250,
      allowedAdTypes: ['SIDEBAR_CARD'],
    },
    {
      placement: 'BLOG_POST_BOTTOM',
      displayName: 'Blog Post — Below Article',
      description: 'Banner below the blog article content',
      pricePerDay: 800,
      isSlider: false,
      sliderInterval: 3000,
      maxAdsPerSlot: 1,
      recommendedWidth: 728,
      recommendedHeight: 90,
      allowedAdTypes: ['BANNER_IMAGE'],
    },
    // The two directory placements that used to sit here were removed in Phase 4.
    // Advertising belongs on editorial surfaces; an advert inside a list of
    // attorneys blurs a paid placement into a listing, whoever bought it.
    // See docs/restructure/LEGAL-GUARDRAILS.md (rules 3 and 4).
    {
      placement: 'LEGAL_LIBRARY_SIDEBAR',
      displayName: 'Legal Library — Right Sidebar',
      description: 'Sidebar of the legal library. Non-legal advertisers only.',
      pricePerDay: 2500,
      isSlider: true,
      sliderInterval: 6000,
      maxAdsPerSlot: 1,
      recommendedWidth: 300,
      recommendedHeight: 250,
      allowedAdTypes: ['SIDEBAR_CARD'],
    },
  ]

  for (const p of placements) {
    await prisma.adPlacementConfig.upsert({
      where: { placement: p.placement as any },
      update: {},
      create: p as any,
    })
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
  console.log(`Seeded ${communitiesData.length} communities`)
  console.log(`Seeded ${placements.length} ad placement configurations`)
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
