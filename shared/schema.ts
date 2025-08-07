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
  nodePfp: jsonb("node_pfp"), // Cache for profile picture data by network
  x: text("x"), // X/Twitter username (without @)
  instagramUsername: text("instagram_username"), // Instagram username (without @)
  facebookUsername: text("facebook_username"), // Facebook username/page name
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
  types: z.array(z.enum(['artist', 'producer', 'songwriter'])).optional(), // Support for multiple roles
  size: z.number(),
  collaborations: z.array(z.string()).optional(),
  imageUrl: z.string().nullable().optional(),
  spotifyId: z.string().nullable().optional(),
  artistId: z.string().nullable().optional(), // MusicNerd artist ID for linking
  musicNerdUrl: z.string().optional(), // Direct URL to MusicNerd artist page
  xUsername: z.string().nullable().optional(), // X/Twitter username (without @)
  instagramUsername: z.string().nullable().optional(), // Instagram username (without @)
  facebookUsername: z.string().nullable().optional(), // Facebook username/page name
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
