import { Types } from "mongoose";
import { Channel, IChannel, ChannelType } from "./channel.model";

export class ChannelRepository {
    async create(data: {
        name: string;
        type: ChannelType;
        organizationId: Types.ObjectId;
        parentId?: Types.ObjectId | null;
        order?: number;
    }): Promise<IChannel> {
        return Channel.create(data);
    }

    async findById(id: Types.ObjectId): Promise<IChannel | null> {
        return Channel.findById(id);
    }

    async findByOrganizationId(organizationId: Types.ObjectId): Promise<IChannel[]> {
        return Channel.find({ organizationId }).sort({ order: 1 });
    }

    async update(
        id: Types.ObjectId,
        updateData: Partial<{
            name: string;
            order: number;
            parentId: Types.ObjectId | null;
        }>
    ): Promise<IChannel | null> {
        return Channel.findByIdAndUpdate(id, updateData, { new: true });
    }

    async delete(id: Types.ObjectId): Promise<IChannel | null> {
        return Channel.findByIdAndDelete(id);
    }
}

export const channelRepository = new ChannelRepository();
