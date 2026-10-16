import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import { AssignPermissionSchema, RemovePermissionSchema } from '@/schemas/subscription.schema'
import { LICENSING_ENABLED } from '@/lib/licensing';
import { licensingOffResponse } from '@/lib/licensingOff';

// Only admins can access these endpoints
async function isAdmin() {
  const session = await getSession()
  return session?.role === 'ADMIN'
}

/**
 * GET /api/admin/permissions
 * Get all permissions
 */
export async function GET(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const permissions = await prisma.permission.findMany({
      orderBy: { category: 'asc' },
    })

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/permissions
 * Create a new permission
 */
export async function POST(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validation = await AssignPermissionSchema.parseAsync(body)

    const permission = await prisma.permission.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        category: body.category,
      },
    })

    return NextResponse.json(permission, { status: 201 })
  } catch (error) {
    console.error('Error creating permission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
