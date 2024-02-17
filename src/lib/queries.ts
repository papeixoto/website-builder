"use server";

import { clerkClient, currentUser } from "@clerk/nextjs";
import { db } from "./db";
import { redirect } from "next/navigation";
import { User } from "@prisma/client";

export const getAuthUserDetails = async () => {
  // from clerk
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // from our DB
  const userData = await db.user.findUnique({
    where: { email: user.emailAddresses[0].emailAddress },
    include: {
      Agency: {
        include: {
          SidebarOption: true,
          SubAccount: {
            include: { SidebarOption: true },
          },
        },
      },
      Permissions: true,
    },
  });

  return userData;
};

export const saveActivityLogsNotification = async ({
  agencyId,
  description,
  subAccountId,
}: {
  agencyId?: string;
  description: string;
  subAccountId?: string;
}) => {
  const authUser = await currentUser();
  let userData;

  // GET USER TO BIND TO NOTIFICATION
  if (authUser) {
    // get user from our DB
    userData = await db.user.findUnique({
      where: {
        email: authUser.emailAddresses[0].emailAddress,
      },
    });
  } else {
    // get random user from that agency
    const response = await db.user.findFirst({
      where: {
        Agency: {
          SubAccount: {
            some: { id: subAccountId },
          },
        },
      },
    });

    if (response) {
      userData = response;
    }
  }

  if (!userData) {
    console.log("Could not find a user");
    return;
  }

  let foundAgencyId = agencyId;
  // GET AGENCY ID
  if (!foundAgencyId) {
    if (!subAccountId) {
      throw new Error("You need to provide an agencyId or a subAccountId");
    }

    const response = await db.subAccount.findUnique({
      where: { id: subAccountId },
    });

    if (response) {
      foundAgencyId = response.agencyId;
    }
  }

  await db.notification.create({
    data: {
      notification: `${userData.name} | ${description}`,
      User: {
        connect: {
          id: userData.id,
        },
      },
      Agency: {
        connect: {
          id: foundAgencyId,
        },
      },
      ...(subAccountId && {
        SubAccount: {
          connect: {
            id: subAccountId,
          },
        },
      }),
    },
  });
};

export const createTeamUser = async (agencyId: string, user: User) => {
  if (user.role === "AGENCY_OWNER") return null;

  const response = await db.user.create({
    data: {
      ...user,
    },
  });

  return response;
};

export const verifyAndAcceptInvitation = async () => {
  const user = await currentUser();

  if (!user) return redirect("/sign-in");

  const invitationExists = await db.invitation.findUnique({
    where: { email: user.emailAddresses[0].emailAddress, status: "PENDING" },
  });

  if (invitationExists) {
    const userDetails = await createTeamUser(invitationExists.agencyId, {
      email: invitationExists.email,
      agencyId: invitationExists.agencyId,
      avatarUrl: user.imageUrl,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: invitationExists.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveActivityLogsNotification({
      agencyId: invitationExists?.agencyId,
      description: "Joined",
      subAccountId: undefined,
    });

    if (userDetails) {
      await clerkClient.users.updateUserMetadata(user.id, {
        privateMetadata: {
          role: userDetails.role || "SUBACCOUNT_USER",
        },
      });

      await db.invitation.delete({
        where: { email: userDetails.email },
      });

      return userDetails.agencyId;
    } else {
      return null;
    }
  } else {
    const agency = await db.user.findUnique({
      where: { email: user.emailAddresses[0].emailAddress },
    });

    return agency?.agencyId;
  }
};
