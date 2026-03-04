import { Types } from "mongoose";
import { channelRepository } from "./channelRepository";
import { ChannelType, IChannel } from "./channel.model";

export class ChannelService {
    async createChannel(data: {
        name: string;
        type: ChannelType;
        organizationId: string;
        parentId?: string;
    }): Promise<IChannel> {
        // Basic validation could be added here
        return channelRepository.create({
            ...data,
            organizationId: new Types.ObjectId(data.organizationId),
            parentId: data.parentId ? new Types.ObjectId(data.parentId) : null,
        });
    }

    async getChannelsByOrganization(orgId: string): Promise<IChannel[]> {
        return channelRepository.findByOrganizationId(new Types.ObjectId(orgId));
    }

    async updateChannel(
        channelId: string,
        updateData: { name?: string; order?: number; parentId?: string | null }
    ): Promise<IChannel | null> {
        const formattedData: any = { ...updateData };
        if (updateData.parentId !== undefined) {
            formattedData.parentId = updateData.parentId ? new Types.ObjectId(updateData.parentId) : null;
        }
        return channelRepository.update(new Types.ObjectId(channelId), formattedData);
    }

    async deleteChannel(channelId: string): Promise<IChannel | null> {
        return channelRepository.delete(new Types.ObjectId(channelId));
    }
}

export const channelService = new ChannelService();
