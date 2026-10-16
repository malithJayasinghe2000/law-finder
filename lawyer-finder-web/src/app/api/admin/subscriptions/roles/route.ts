import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { LICENSING_ENABLED } from '@/lib/licensing';
import { licensingOffResponse } from '@/lib/licensingOff';

export async function GET(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const roles = await prisma.subscriptionRole.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.permissions.map(rp => rp.permission)
    }));

    return NextResponse.json(formattedRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, permissionIds = [] } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Role name is required' },
        { status: 400 }
      );
    }

    const role = await prisma.subscriptionRole.create({
      data: {
        name,
        description: description || null
      }
    });

    // Assign permissions
    if (permissionIds.length > 0) {
      await prisma.subscriptionRolePermission.createMany({
        data: permissionIds.map((id: string) => ({
          roleId: role.id,
          permissionId: id
        })),
        skipDuplicates: true
      });
    }

    const roleWithPermissions = await prisma.subscriptionRole.findUnique({
      where: { id: role.id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        id: roleWithPermissions?.id,
        name: roleWithPermissions?.name,
        description: roleWithPermissions?.description,
        permissions: roleWithPermissions?.permissions.map(rp => rp.permission)
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, permissionIds = [] } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const role = await prisma.subscriptionRole.update({
      where: { id },
      data: {
        name,
        description: description || null
      }
    });

    // Update permissions
    await prisma.subscriptionRolePermission.deleteMany({
      where: { roleId: id }
    });

    if (permissionIds.length > 0) {
      await prisma.subscriptionRolePermission.createMany({
        data: permissionIds.map((permId: string) => ({
          roleId: id,
          permissionId: permId
        })),
        skipDuplicates: true
      });
    }

    const roleWithPermissions = await prisma.subscriptionRole.findUnique({
      where: { id: role.id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    return NextResponse.json({
      id: roleWithPermissions?.id,
      name: roleWithPermissions?.name,
      description: roleWithPermissions?.description,
      permissions: roleWithPermissions?.permissions.map(rp => rp.permission)
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Hidden while licensing is off (src/lib/licensing.ts).
  if (!LICENSING_ENABLED) return licensingOffResponse();

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    await prisma.subscriptionRolePermission.deleteMany({
      where: { roleId: id }
    });

    await prisma.subscriptionRole.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
