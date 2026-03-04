import { Types } from "mongoose";
import { Member, MemberRole, IMember } from "./member.model";

export class MemberRepository {
    async addMember(data: {
        userId: Types.ObjectId;
        organizationId: Types.ObjectId;
        role?: MemberRole;
    }): Promise<IMember> {
        return Member.create(data);
    }

    async findByUserId(userId: Types.ObjectId): Promise<IMember[]> {
        return Member.find({ userId }).populate("organizationId");
    }

    async findByOrganizationId(organizationId: Types.ObjectId): Promise<IMember[]> {
        return Member.find({ organizationId }).populate("userId");
    }

    async findMember(userId: Types.ObjectId, organizationId: Types.ObjectId): Promise<IMember | null> {
        return Member.findOne({ userId, organizationId });
    }

    async updateRole(
        userId: Types.ObjectId,
        organizationId: Types.ObjectId,
        role: MemberRole
    ): Promise<IMember | null> {
        return Member.findOneAndUpdate(
            { userId, organizationId },
            { role },
            { new: true }
        );
    }

    async removeMember(userId: Types.ObjectId, organizationId: Types.ObjectId): Promise<IMember | null> {
        return Member.findOneAndDelete({ userId, organizationId });
    }
}

export const memberRepository = new MemberRepository();
