import { relations } from "drizzle-orm/relations";
import { users, photos, infoRequests, skipReasons, messages, partners, ads, adImpressions, coupons, formSchemas, formFields, emailCampaigns, campaignRecipients, unsubscribes, session, profiles, auditLogs, account } from "./db-schema";

export const photosRelations = relations(photos, ({one, many}) => ({
	user: one(users, {
		fields: [photos.userId],
		references: [users.id]
	}),
	profiles: many(profiles),
}));

export const usersRelations = relations(users, ({many}) => ({
	photos: many(photos),
	infoRequests_requesterId: many(infoRequests, {
		relationName: "infoRequests_requesterId_users_id"
	}),
	infoRequests_targetId: many(infoRequests, {
		relationName: "infoRequests_targetId_users_id"
	}),
	skipReasons_requesterId: many(skipReasons, {
		relationName: "skipReasons_requesterId_users_id"
	}),
	skipReasons_targetId: many(skipReasons, {
		relationName: "skipReasons_targetId_users_id"
	}),
	messages_senderId: many(messages, {
		relationName: "messages_senderId_users_id"
	}),
	messages_recipientId: many(messages, {
		relationName: "messages_recipientId_users_id"
	}),
	emailCampaigns: many(emailCampaigns),
	campaignRecipients: many(campaignRecipients),
	unsubscribes: many(unsubscribes),
	sessions: many(session),
	profiles: many(profiles),
	auditLogs: many(auditLogs),
	accounts: many(account),
}));

export const infoRequestsRelations = relations(infoRequests, ({one}) => ({
	user_requesterId: one(users, {
		fields: [infoRequests.requesterId],
		references: [users.id],
		relationName: "infoRequests_requesterId_users_id"
	}),
	user_targetId: one(users, {
		fields: [infoRequests.targetId],
		references: [users.id],
		relationName: "infoRequests_targetId_users_id"
	}),
}));

export const skipReasonsRelations = relations(skipReasons, ({one}) => ({
	user_requesterId: one(users, {
		fields: [skipReasons.requesterId],
		references: [users.id],
		relationName: "skipReasons_requesterId_users_id"
	}),
	user_targetId: one(users, {
		fields: [skipReasons.targetId],
		references: [users.id],
		relationName: "skipReasons_targetId_users_id"
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	user_senderId: one(users, {
		fields: [messages.senderId],
		references: [users.id],
		relationName: "messages_senderId_users_id"
	}),
	user_recipientId: one(users, {
		fields: [messages.recipientId],
		references: [users.id],
		relationName: "messages_recipientId_users_id"
	}),
}));

export const adsRelations = relations(ads, ({one, many}) => ({
	partner: one(partners, {
		fields: [ads.partnerId],
		references: [partners.id]
	}),
	adImpressions: many(adImpressions),
}));

export const partnersRelations = relations(partners, ({many}) => ({
	ads: many(ads),
	coupons: many(coupons),
}));

export const adImpressionsRelations = relations(adImpressions, ({one}) => ({
	ad: one(ads, {
		fields: [adImpressions.adId],
		references: [ads.id]
	}),
}));

export const couponsRelations = relations(coupons, ({one}) => ({
	partner: one(partners, {
		fields: [coupons.partnerId],
		references: [partners.id]
	}),
}));

export const formFieldsRelations = relations(formFields, ({one}) => ({
	formSchema: one(formSchemas, {
		fields: [formFields.schemaId],
		references: [formSchemas.id]
	}),
}));

export const formSchemasRelations = relations(formSchemas, ({many}) => ({
	formFields: many(formFields),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({one, many}) => ({
	user: one(users, {
		fields: [emailCampaigns.createdById],
		references: [users.id]
	}),
	campaignRecipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({one}) => ({
	emailCampaign: one(emailCampaigns, {
		fields: [campaignRecipients.campaignId],
		references: [emailCampaigns.id]
	}),
	user: one(users, {
		fields: [campaignRecipients.userId],
		references: [users.id]
	}),
}));

export const unsubscribesRelations = relations(unsubscribes, ({one}) => ({
	user: one(users, {
		fields: [unsubscribes.userId],
		references: [users.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(users, {
		fields: [session.userId],
		references: [users.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	photo: one(photos, {
		fields: [profiles.aiAvatarId],
		references: [photos.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(users, {
		fields: [account.userId],
		references: [users.id]
	}),
}));