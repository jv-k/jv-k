/**
 * @fileoverview Zod schemas for runtime validation of YAML data and configuration
 * @author John Valai <git@jvk.to>
 */

import { z } from 'zod';

// ============================================================================
// Hex Color Schema
// ============================================================================

/**
 * Validates hex color codes (with or without # prefix)
 * Accepts: #FFF, #FFFFFF, FFF, FFFFFF
 */
export const HexColorSchema = z
  .string()
  .regex(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Invalid hex color. Must be 3 or 6 hex characters (with or without #)',
  });

/**
 * Normalizes a hex color to 6-digit format without #
 */
export function normalizeHexColor(color: string): string {
  const hex = color.replace(/^#/, '');
  if (hex.length === 3) {
    return hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return hex;
}

// ============================================================================
// URL Schema
// ============================================================================

/**
 * Validates URLs (http/https)
 */
export const UrlSchema = z.string().url({ message: 'Invalid URL format' });

// ============================================================================
// Skill Schema
// ============================================================================

/**
 * Icon slug pattern - lowercase alphanumeric with optional dots
 * Matches simple-icons naming convention: javascript, nodedotjs, cplusplus
 */
export const IconSlugSchema = z
  .string()
  .min(1, { message: 'Icon name cannot be empty' })
  .regex(/^[a-z0-9]+(?:dot[a-z0-9]+)*$/, {
    message:
      'Icon name must be lowercase alphanumeric (use "dot" for periods, e.g., "nodedotjs")',
  });

/**
 * Individual skill/technology definition
 */
export const SkillSchema = z.object({
  name: IconSlugSchema,
  color: HexColorSchema,
  url: UrlSchema,
});

export type Skill = z.infer<typeof SkillSchema>;

// ============================================================================
// Skills Data Schema
// ============================================================================

/**
 * Category name validation
 */
export const CategoryNameSchema = z
  .string()
  .min(1, { message: 'Category name cannot be empty' })
  .max(50, { message: 'Category name too long (max 50 chars)' });

/**
 * Skills grouped by category
 */
export const SkillsDataSchema = z.record(
  CategoryNameSchema,
  z.array(SkillSchema).min(1, { message: 'Category must have at least one skill' })
);

export type SkillsData = z.infer<typeof SkillsDataSchema>;

// ============================================================================
// Root YAML Schema
// ============================================================================

/**
 * Root structure of the skills YAML file
 */
export const SkillsYamlRootSchema = z.object({
  Skillset: SkillsDataSchema,
});

export type SkillsYamlRoot = z.infer<typeof SkillsYamlRootSchema>;

// ============================================================================
// Icon Manifest Schemas
// ============================================================================

/**
 * Entry in the icon manifest file
 */
export const IconManifestEntrySchema = z.object({
  version: z.string(),
  color: z.string().regex(/^[A-Fa-f0-9]{6}$/, { message: 'Color must be 6-digit hex without #' }),
  hash: z.string().startsWith('sha256:'),
  fetchedAt: z.string().datetime(),
});

export type IconManifestEntry = z.infer<typeof IconManifestEntrySchema>;

/**
 * Icon manifest structure
 */
export const IconManifestSchema = z.object({
  generatedAt: z.string().datetime(),
  simpleIconsLatest: z.string(),
  icons: z.record(z.string(), IconManifestEntrySchema),
});

export type IconManifest = z.infer<typeof IconManifestSchema>;

// ============================================================================
// Icon Fetcher Types
// ============================================================================

/**
 * Icon requirement from YAML data
 */
export const IconRequirementSchema = z.object({
  slug: z.string(),
  color: z.string(),
});

export type IconRequirement = z.infer<typeof IconRequirementSchema>;

/**
 * Result of fetching a single icon
 */
export const IconFetchResultSchema = z.object({
  slug: z.string(),
  svg: z.string(),
  version: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

export type IconFetchResult = z.infer<typeof IconFetchResultSchema>;

/**
 * simple-icons package version info from jsDelivr API
 */
export const PackageVersionInfoSchema = z.object({
  versions: z.array(z.object({ version: z.string() })),
});

export type PackageVersionInfo = z.infer<typeof PackageVersionInfoSchema>;

// ============================================================================
// Configuration Schemas
// ============================================================================

/**
 * SkillSet configuration
 */
export const SkillSetConfigSchema = z.object({
  datafile: z.string().min(1),
  tpl_section: z.string().min(1),
  tpl_icon: z.string().min(1),
  tag_start: z.string().min(1),
  tag_end: z.string().min(1),
  file_input: z.string().min(1),
  file_output: z.string().min(1),
  // Icon fetcher settings
  icons_output_dir: z.string().min(1),
  icons_manifest_path: z.string().min(1),
  icons_cdn_base_url: z.string().url(),
  icons_package_api_url: z.string().url(),
  icons_fallback_cdn_url: z.string().url(),
  icons_concurrency_limit: z.number().int().positive(),
  icons_request_timeout: z.number().int().positive(),
  icons_max_retries: z.number().int().nonnegative(),
  icons_min_major_version: z.number().int().positive(),
});

export type SkillSetConfig = z.infer<typeof SkillSetConfigSchema>;

/**
 * CLI options
 */
export const CliOptionsSchema = z.object({
  build: z.boolean().optional(),
  config: z.string(),
  env: z.string(),
  output: z.string().optional(),
  silent: z.boolean(),
  verbose: z.boolean(),
});

export type CliOptions = z.infer<typeof CliOptionsSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates YAML data and returns typed result
 * @throws ZodError if validation fails
 */
export function validateSkillsYaml(data: unknown): SkillsYamlRoot {
  return SkillsYamlRootSchema.parse(data);
}

/**
 * Safe parse result type for Zod v4
 */
export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Safely validates YAML data, returning success/error result
 */
export function safeValidateSkillsYaml(data: unknown): SafeParseResult<SkillsYamlRoot> {
  return SkillsYamlRootSchema.safeParse(data);
}

/**
 * Validates a single skill entry
 */
export function validateSkill(skill: unknown): Skill {
  return SkillSchema.parse(skill);
}

/**
 * Validates icon manifest
 */
export function validateManifest(manifest: unknown): IconManifest {
  return IconManifestSchema.parse(manifest);
}

/**
 * Format Zod errors into readable messages
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
