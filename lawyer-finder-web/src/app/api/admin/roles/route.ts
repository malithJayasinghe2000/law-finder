import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'

async function isAdmin() {
  const session = await getSession()
  return session?.role === 'ADMIN'
}

/**
 * GET /api/admin/roles
 * Get all subscription roles with their permissions and feature limits
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const roles = await prisma.subscriptionRole.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        featureLimits: true,
      },
    })

    return NextResponse.json(roles)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/roles/[roleId]
 * Get a specific subscription role with details
 */
export async function GET_ROLE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { roleId } = await params

    const role = await prisma.subscriptionRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        featureLimits: true,
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Error fetching role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
