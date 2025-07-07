import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const artists = pgTable("artists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // 'artist', 'producer', 'songwriter'
  imageUrl: text("image_url"),
  spotifyId: text("spotify_id"),
  webmapdata: jsonb("webmapdata"), // Cache for network visualization data
});

export const collaborations = pgTable("collaborations", {
  id: serial("id").primaryKey(),
  fromArtistId: integer("from_artist_id").notNull(),
  toArtistId: integer("to_artist_id").notNull(),
  collaborationType: text("collaboration_type").notNull(), // 'production', 'songwriting'
});

export const insertArtistSchema = createInsertSchema(artists).omit({
  id: true,
});

export const insertCollaborationSchema = createInsertSchema(collaborations).omit({
  id: true,
});

export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Artist = typeof artists.$inferSelect;
export type InsertCollaboration = z.infer<typeof insertCollaborationSchema>;
export type Collaboration = typeof collaborations.$inferSelect;

// Network data types for API responses
export const networkNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['artist', 'producer', 'songwriter']),
  types: z.array(z.enum(['artist', 'producer', 'songwriter'])), // Support for multiple roles
  size: z.number(),
  topCollaborations: z.array(z.string()).optional(),
  artistId: z.string().nullable().optional(), // MusicNerd artist ID for linking
});

export const networkLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const networkDataSchema = z.object({
  nodes: z.array(networkNodeSchema),
  links: z.array(networkLinkSchema),
  cached: z.boolean().optional(),
});

export type NetworkNode = z.infer<typeof networkNodeSchema>;
export type NetworkLink = z.infer<typeof networkLinkSchema>;
export type NetworkData = z.infer<typeof networkDataSchema>;
