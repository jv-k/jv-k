/**
 * @fileoverview Definition of the SkillSet class - Core README generator
 * 
 * This file contains the SkillSet class which is the heart of the README generator.
 * It orchestrates the entire process of loading data, rendering HTML, and creating
 * the final README file.
 * 
 * RESPONSIBILITIES:
 * 1. Load and validate configuration
 * 2. Read skills data from YAML file
 * 3. Render HTML icons using Pug templates
 * 4. Load README template
 * 5. Replace placeholder tags with generated HTML
 * 6. Write final README to output file
 * 
 * WORKFLOW:
 * Constructor → renderReadme() → getData() → renderSkillsHtml() → 
 * getReadmeFile() → prepareHtml() → writeReadmeFile() → Complete
 * 
 * @author John Valai <git@jvk.to>
 */

// Import Node.js filesystem promises API for async file operations
import fs from 'fs/promises';

// Import js-yaml for parsing YAML files into JavaScript objects
import yaml from 'js-yaml';

// Import Pug templating engine for generating HTML from templates
import pug from 'pug';

// Import logger utility for consistent logging throughout the class
import { createLogger, type Logger } from './logger.js';

// Import TypeScript type definitions for type safety
import type {
  SkillSetConfig,      // Configuration structure
  SkillsData,          // Skills grouped by category
  SkillsYamlRoot,      // Root YAML structure
  SkillSetOptions,     // Constructor options
  IconTemplateData,    // Data for icon template
  SectionTemplateData, // Data for section template
  Skill,               // Individual skill structure
} from '../types/index.js';

/**
 * SkillSet Class
 * 
 * Generates a list of skillset icons and inserts them into a template to create a README.md file.
 * 
 * This class follows the Single Responsibility Principle - it's solely focused on
 * README generation. Icon fetching is handled by IconFetcherService separately.
 * 
 * DESIGN PATTERNS:
 * - Uses private fields (# prefix) for encapsulation
 * - Orchestration pattern: renderReadme() coordinates all operations
 * - Template Method pattern: Each step is a separate method
 * 
 * USAGE:
 * ```typescript
 * const config = configLoad('./config.yaml');
 * const skillset = new SkillSet(config, { silent: false });
 * await skillset.renderReadme();
 * ```
 */
class SkillSet {
  // ============================================================================
  // PRIVATE FIELDS
  // ============================================================================
  // Using private fields (# prefix) ensures encapsulation and prevents external access
  
  readonly #config: SkillSetConfig;    // Configuration loaded from YAML (immutable)
  #skillsHtml = '';                    // Generated HTML for all skills
  #readmeMD = '';                      // Original README template content
  #readmeHTML = '';                    // Final README with HTML injected
  #skillsData: SkillsData = {};        // Parsed skills data from YAML
  readonly #logger: Logger;             // Logger instance (immutable)

  /**
   * Constructor - Initializes a new SkillSet instance
   * 
   * VALIDATIONS:
   * - Checks that all required config fields are present
   * - Throws error if any required field is missing
   * 
   * @param config - Configuration object loaded from config.yaml
   * @param options - Optional settings (e.g., silent mode)
   * @throws {Error} If required config fields are missing
   */
  constructor(config: SkillSetConfig, options: SkillSetOptions = {}) {
    // Define list of required configuration fields
    // These MUST be present for the generator to work
    const requiredFields: (keyof SkillSetConfig)[] = [
      'datafile',      // Path to skills YAML file
      'file_input',    // Path to README template
      'file_output',   // Path for output README
      'tag_start',     // Start placeholder tag
      'tag_end',       // End placeholder tag
      'tpl_section',   // Section template path
      'tpl_icon',      // Icon template path
    ];
    
    // Filter to find any missing fields
    // Returns array of field names that are falsy (undefined, null, empty string)
    const missing = requiredFields.filter((field) => !config[field]);

    // If any required fields are missing, throw descriptive error
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }

    // Store configuration (spread operator creates a shallow copy for safety)
    this.#config = { ...config };
    
    // Initialize logger with silent mode if specified
    // Silent mode suppresses all log output (useful for testing)
    this.#logger = createLogger(options.silent);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Escapes special regex characters in a string
   * 
   * This is essential for using user-provided strings (like placeholder tags)
   * in regular expressions. Without escaping, special regex characters like
   * ., *, +, ?, etc. would be interpreted as regex operators.
   * 
   * EXAMPLE:
   * escapeRegex('<!-- START -->') → '\\<\\!\\-\\- START \\-\\-\\>'
   * 
   * @param str - String to escape
   * @returns String with special regex characters escaped
   */
  escapeRegex = (str: string): string => {
    // Replace all special regex characters with escaped versions
    // [.*+?^${}()|[\]\\] = character class of special regex chars
    // \\$& = replacement: backslash + the matched character
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  /**
   * Retrieves the skills icon data from a YAML data file
   * 
   * This method loads and parses the skills YAML file (src/data/mystack.yml).
   * The YAML structure is: { Skillset: { 'Category': [skills...] } }
   * 
   * YAML FORMAT:
   * ```yaml
   * Skillset:
   *   'Languages':
   *     - name: typescript
   *       color: '#3178C6'
   *       url: https://...
   *   'Frontend':
   *     - name: react
   *       ...
   * ```
   * 
   * NOTE: This method does NOT validate the YAML structure.
   * Consider adding Zod validation here for production use.
   * 
   * @returns Promise resolving to SkillsData object (skills grouped by category)
   * @throws {Error} If file not found or YAML parsing fails
   */
  getData = async (): Promise<SkillsData> => {
    // Read file asynchronously as UTF-8 string
    const fileContent = await fs.readFile(this.#config.datafile, 'utf8');
    this.#logger.info(`Loaded yaml skillset data from <${this.#config.datafile}>`);
    
    // Parse YAML string into JavaScript object
    // Cast to SkillsYamlRoot type (we assume the structure is correct)
    const parsed = yaml.load(fileContent) as SkillsYamlRoot;
    
    // Return just the Skillset property (the actual skills data)
    // This strips away the root wrapper
    return parsed.Skillset;
  };

  // ============================================================================
  // HTML GENERATION
  // ============================================================================

  /**
   * Generates HTML for all skills icons using Pug templates
   * 
   * This is the core rendering method that transforms skills data into HTML.
   * It uses two Pug templates:
   * 1. section.pug - Wraps icons for a category in <section> with heading
   * 2. icon.pug - Generates individual <a><img></a> for each skill
   * 
   * PROCESS:
   * For each category:
   *   For each skill in category:
   *     - Render icon.pug → icon HTML
   *     - Accumulate icon HTML
   *   - Render section.pug with all icons → section HTML
   *   - Accumulate section HTML
   * Return complete HTML
   * 
   * TEMPLATE DATA:
   * - IconTemplateData: { name, url, color }
   * - SectionTemplateData: { name, icons }
   * 
   * @returns Complete HTML string with all skills icons
   */
  renderSkillsHtml = (): string => {
    let html = '';  // Accumulator for complete HTML output
    
    // Reference to loaded skills data
    const skillset = this.#skillsData;
    
    // Get array of category names (e.g., ['Languages', 'Frontend', ...])
    const topics = Object.keys(skillset);
    
    // Compile Pug templates into functions
    // These functions take data objects and return HTML strings
    // Compilation happens once, execution happens many times (efficient)
    const tplSection = pug.compileFile(this.#config.tpl_section);
    const tplIcon = pug.compileFile(this.#config.tpl_icon);

    // Iterate through each category/topic in the skillset
    topics.forEach((topic) => {
      // Get skills array for this topic
      // Using optional check in case the key returns undefined
      const skills = skillset[topic];
      if (!skills) return;  // Skip empty categories

      // Initialize empty string to accumulate icon HTML for this section
      let iconsHtml = '';

      // Generate HTML for each skill in this category
      skills.forEach((skill: Skill) => {
        // Prepare data object for icon template
        const iconData: IconTemplateData = {
          name: skill.name,               // Icon slug (e.g., 'typescript')
          url: skill.url,                 // Link URL
          color: skill.color.replace('#', ''),  // Remove # prefix from hex color
        };
        
        // Render icon template with data and append to icons HTML
        // tplIcon is a compiled Pug function that returns HTML string
        iconsHtml += tplIcon(iconData);
      });

      // Prepare data object for section template
      const sectionData: SectionTemplateData = {
        name: topic,        // Category name (e.g., 'Languages', 'Frontend')
        icons: iconsHtml,   // All icon HTML for this category
      };
      
      // Render section template and append to complete HTML
      // tplSection wraps the icons in a <section> with category heading
      html += tplSection(sectionData);
    });

    // Log completion
    this.#logger.info('Rendered skillset html.');
    return html;
  };

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Reads the markdown README template file
   * 
   * This loads the base README template that contains placeholder tags.
   * The template has static content plus special comments marking where
   * to inject the generated skills HTML.
   * 
   * EXAMPLE TEMPLATE:
   * ```markdown
   * # My Profile
   * <!-- START mystack -->
   * (this will be replaced)
   * <!-- END mystack -->
   * ```
   * 
   * @returns Promise resolving to template content as string
   */
  getReadmeFile = async (): Promise<string> => {
    // Use fs.promises for async file reading
    // 'utf8' ensures we get a string, not a Buffer
    const data = await fs.readFile(this.#config.file_input, 'utf8');
    this.#logger.info(`Loaded file: <${this.#config.file_input}>`);
    return data;
  };

  /**
   * Replaces the placeholder tags in the README with skill icons HTML
   * 
   * This method uses regex to find and replace content between placeholder tags.
   * The regex pattern matches everything between tag_start and tag_end, including
   * any existing content (which will be replaced).
   * 
   * REGEX EXPLANATION:
   * - (tag_start): Captures the start tag (we want to keep this)
   * - [\\s\\S]*?: Matches any content (including newlines) between tags (non-greedy)
   * - (tag_end): Captures the end tag (we want to keep this)
   * - 'g' flag: Global matching (replace all occurrences)
   * 
   * REPLACEMENT:
   * - $1: First capture group (tag_start)
   * - \n${this.#skillsHtml}\n: Generated HTML with newlines
   * - $2: Second capture group (tag_end)
   * 
   * BEFORE:
   * <!-- START mystack -->old content<!-- END mystack -->
   * 
   * AFTER:
   * <!-- START mystack -->
   * <section>...</section>
   * <!-- END mystack -->
   * 
   * @returns Final README content with HTML injected
   */
  prepareHtml = (): string => {
    // Build regex pattern with escaped placeholder tags
    // escapeRegex ensures special chars in tags don't break the regex
    const re = new RegExp(
      `(${this.escapeRegex(this.#config.tag_start)})[\\s\\S]*?(${this.escapeRegex(
        this.#config.tag_end
      )})`,
      'g'  // Global flag to replace all occurrences
    );

    // Replace content between tags with generated HTML
    // Keeps the tags themselves but replaces everything between them
    return this.#readmeMD.replace(re, `$1\n${this.#skillsHtml}\n$2`);
  };

  /**
   * Writes the generated README to the output file
   * 
   * This is the final step - writing the complete README with injected
   * skills HTML to the specified output path.
   * 
   * NOTE: Parent directory must exist or this will throw an error.
   * Consider adding fs.mkdir with recursive option if needed.
   * 
   * @returns Promise that resolves when file is written
   */
  writeReadmeFile = async (): Promise<void> => {
    // Write final HTML to output file
    // Uses utf8 encoding by default
    await fs.writeFile(this.#config.file_output, this.#readmeHTML);
    this.#logger.info(`Wrote output to file: <${this.#config.file_output}>`);
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Main orchestration method - generates the complete README
   * 
   * This is the PUBLIC API method that coordinates the entire README generation process.
   * It calls all the other methods in the correct sequence to produce the final output.
   * 
   * PROCESS FLOW:
   * 1. getData()          - Load and parse skills from YAML
   * 2. renderSkillsHtml() - Generate HTML from Pug templates
   * 3. getReadmeFile()    - Load README template
   * 4. prepareHtml()      - Inject HTML into template
   * 5. writeReadmeFile()  - Write final output
   * 
   * ERROR HANDLING:
   * - Catches filesystem errors (ENOENT = file not found)
   * - Catches YAML parsing errors
   * - Logs detailed error messages
   * - Re-throws for caller to handle
   * 
   * USAGE:
   * ```typescript
   * const skillset = new SkillSet(config);
   * await skillset.renderReadme();  // Complete README generation
   * ```
   * 
   * @returns Promise that resolves when README is generated
   * @throws {Error} If any step fails (file not found, YAML error, etc.)
   */
  renderReadme = async (): Promise<void> => {
    try {
      // STEP 1: Load skills data from YAML file
      // Reads src/data/mystack.yml, parses it, and stores in #skillsData
      this.#skillsData = await this.getData();
      
      // STEP 2: Generate HTML from skills data
      // Compiles Pug templates and renders all skills into HTML string
      // Result stored in #skillsHtml
      this.#skillsHtml = this.renderSkillsHtml();
      
      // STEP 3: Load README template
      // Reads the template file (src/templates/readme.tpl.md)
      // Result stored in #readmeMD
      this.#readmeMD = await this.getReadmeFile();
      
      // STEP 4: Inject HTML into template
      // Replaces placeholder tags with generated HTML
      // Result stored in #readmeHTML (final output)
      this.#readmeHTML = this.prepareHtml();
      
      // STEP 5: Write final README to disk
      // Writes #readmeHTML to output file (build/readme.md)
      await this.writeReadmeFile();
      
    } catch (error) {
      // Error handling with specific messages for different error types
      if (error instanceof Error) {
        // Cast to NodeJS.ErrnoException to access code and path properties
        const nodeError = error as NodeJS.ErrnoException;
        
        // ENOENT = "Error NO ENTity" (file/directory not found)
        if (nodeError.code === 'ENOENT') {
          this.#logger.error(`File not found: ${nodeError.path}`);
        } 
        // YAML parsing errors (invalid syntax, structure, etc.)
        else if (error instanceof yaml.YAMLException) {
          this.#logger.error(`YAML parsing error: ${error.message}`);
        } 
        // Generic error fallback
        else {
          this.#logger.error(`Error: ${error.message}`);
        }
      }
      
      // Re-throw error so caller can handle it
      // This allows CLI to display error and exit with non-zero code
      throw error;
    }
  };
}

// Export as default for convenient importing
// Usage: import SkillSet from './lib/skillset.js';
export default SkillSet;
