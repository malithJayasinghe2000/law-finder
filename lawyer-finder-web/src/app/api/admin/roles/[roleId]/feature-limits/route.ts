import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { UpdateFeatureLimitsSchema } from '@/schemas/subscription.schema'

async function isAdmin() {
  const session = await getSession()
  return session?.role === 'ADMIN'
}

/**
 * GET /api/admin/roles/[roleId]/feature-limits
 * Get feature limits for a role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { roleId } = await params

    const limits = await prisma.featureLimitConfig.findMany({
      where: { roleId },
    })

    return NextResponse.json(limits)
  } catch (error) {
    console.error('Error fetching feature limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/roles/[roleId]/feature-limits
 * Update feature limits for a role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { roleId } = await params
    const body = await request.json()

    // Validate input
    const validation = UpdateFeatureLimitsSchema.parse({
      roleId,
      limits: body.limits,
    })

    // Verify role exists
    const role = await prisma.subscriptionRole.findUnique({
      where: { id: roleId },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Get current limits to find deleted ones
    const currentLimits = await prisma.featureLimitConfig.findMany({
      where: { roleId },
    })
    
    const incomingFeatureNames = body.limits.map((l: any) => l.featureName)
    const limitsToDelete = currentLimits.filter(l => !incomingFeatureNames.includes(l.featureName))

    // Delete removed limits
    if (limitsToDelete.length > 0) {
      await prisma.featureLimitConfig.deleteMany({
        where: {
          roleId,
          featureName: { in: limitsToDelete.map(l => l.featureName) }
        }
      })
    }

    // Update or create limits
    const updated = await Promise.all(
      body.limits.map(({ featureName, limit }: { featureName: string; limit: number }) =>
        prisma.featureLimitConfig.upsert({
          where: {
            roleId_featureName: {
              roleId,
              featureName,
            },
          },
          update: { limit },
          create: {
            roleId,
            featureName,
            limit,
          },
        })
      )
    )

    return NextResponse.json({
      message: `Updated ${updated.length} feature limits`,
      limits: updated,
    })
  } catch (error) {
    console.error('Error updating feature limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
