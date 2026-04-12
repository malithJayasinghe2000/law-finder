import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { roleId } = await params;
    const body = await request.json();
    const { name, description, permissionIds = [] } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    const role = await prisma.subscriptionRole.update({
      where: { id: roleId },
      data: {
        name,
        description: description || null
      }
    });

    // Update permissions
    await prisma.subscriptionRolePermission.deleteMany({
      where: { roleId }
    });

    if (permissionIds.length > 0) {
      await prisma.subscriptionRolePermission.createMany({
        data: permissionIds.map((permId: string) => ({
          roleId,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { roleId } = await params;

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Delete permissions first due to foreign key constraints
    await prisma.subscriptionRolePermission.deleteMany({
      where: { roleId }
    });

    await prisma.subscriptionRole.delete({
      where: { id: roleId }
    });

    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
