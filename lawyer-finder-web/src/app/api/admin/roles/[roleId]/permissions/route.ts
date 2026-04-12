import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/db'
import {
  AssignPermissionSchema,
  RemovePermissionSchema,
} from '@/schemas/subscription.schema'

async function isAdmin() {
  const session = await getSession()
  return session?.role === 'ADMIN'
}

/**
 * GET /api/admin/roles/[roleId]/permissions
 * Get all permissions for a role
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

    const rolePermissions = await prisma.subscriptionRolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
    })

    const permissions = rolePermissions.map((rp) => rp.permission)

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error fetching role permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/roles/[roleId]/permissions/assign
 * Assign permissions to a role
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
    const validation = AssignPermissionSchema.parse({
      roleId,
      permissionIds: body.permissionIds,
    })

    // Verify role exists
    const role = await prisma.subscriptionRole.findUnique({
      where: { id: roleId },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Assign permissions
    const assigned = await Promise.all(
      body.permissionIds.map((permissionId: string) =>
        prisma.subscriptionRolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId,
            },
          },
          update: {},
          create: {
            roleId,
            permissionId,
          },
        })
      )
    )

    return NextResponse.json(
      {
        message: `Assigned ${assigned.length} permissions to role`,
        count: assigned.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error assigning permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/roles/[roleId]/permissions
 * Sync (replace all) permissions for a role
 */
export async function PUT(
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
    const validation = AssignPermissionSchema.parse({
      roleId,
      permissionIds: body.permissionIds,
    })

    // Verify role exists
    const role = await prisma.subscriptionRole.findUnique({
      where: { id: roleId },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Sync permissions: Delete all existing, then insert the new ones
    await prisma.$transaction([
      prisma.subscriptionRolePermission.deleteMany({
        where: { roleId },
      }),
      prisma.subscriptionRolePermission.createMany({
        data: body.permissionIds.map((permissionId: string) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      }),
    ])

    return NextResponse.json(
      {
        message: `Synced ${body.permissionIds.length} permissions to role`,
        count: body.permissionIds.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error syncing permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/roles/[roleId]/permissions/remove
 * Remove permissions from a role
 */
export async function DELETE(
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
    const validation = RemovePermissionSchema.parse({
      roleId,
      permissionIds: body.permissionIds,
    })

    // Remove permissions
    const removed = await Promise.all(
      body.permissionIds.map((permissionId: string) =>
        prisma.subscriptionRolePermission.deleteMany({
          where: {
            roleId,
            permissionId,
          },
        })
      )
    )

    const totalRemoved = removed.reduce((sum, result) => sum + result.count, 0)

    return NextResponse.json({
      message: `Removed ${totalRemoved} permissions from role`,
      count: totalRemoved,
    })
  } catch (error) {
    console.error('Error removing permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
