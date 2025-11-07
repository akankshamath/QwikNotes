/**
 * Notion MCP Tools - Direct implementation for serverless environments
 */

import { Client } from "@notionhq/client";

// Type definitions for Notion API responses
interface NotionRichText {
  plain_text: string;
  type: string;
  text?: {
    content: string;
  };
}

interface NotionTitleProperty {
  type: "title";
  title: NotionRichText[];
}

interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionTitleProperty | unknown>;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked: boolean };
  code?: { rich_text: NotionRichText[] };
}

interface NotionDatabase {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  title: NotionRichText[];
}

// Initialize Notion client with user-specific token
function getNotionClient(accessToken: string) {
  if (!accessToken) {
    throw new Error("Notion access token is required. Please connect your Notion workspace.");
  }

  return new Client({ auth: accessToken });
}

//search Notion
export async function searchNotion(query: string, accessToken: string) {
  try {
    const notion = getNotionClient(accessToken);

    const response = await notion.search({
      query,
      filter: {
        property: "object",
        value: "page",
      },
      page_size: 10,
    });

    const results = response.results.map((page: any) => {
      // Extract title from different title property types
      let title = "Untitled";
      if (page.properties) {
        const titleProp = Object.values(page.properties).find(
          (prop: any) => prop.type === "title"
        ) as any;
        if (titleProp?.title?.[0]?.plain_text) {
          title = titleProp.title[0].plain_text;
        }
      }

      return {
        id: page.id,
        title,
        url: page.url,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
      };
    });

    return {
      query,
      results,
      count: results.length,
    };
  } catch (error) {
    throw new Error(
      `Notion search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

//Get content from a Notion page
export async function getNotionPage(pageId: string, accessToken: string) {
  try {
    const notion = getNotionClient(accessToken);

    // Get page properties
    const page = await notion.pages.retrieve({ page_id: pageId });

    // Get page content (blocks)
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    });

    // Extract text from blocks
    const content = blocks.results
      .map((block: any) => {
        // Handle different block types
        if (block.type === "paragraph" && block.paragraph?.rich_text) {
          return block.paragraph.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "heading_1" && block.heading_1?.rich_text) {
          return "# " + block.heading_1.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "heading_2" && block.heading_2?.rich_text) {
          return "## " + block.heading_2.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "heading_3" && block.heading_3?.rich_text) {
          return "### " + block.heading_3.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "bulleted_list_item" && block.bulleted_list_item?.rich_text) {
          return "• " + block.bulleted_list_item.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "numbered_list_item" && block.numbered_list_item?.rich_text) {
          return "- " + block.numbered_list_item.rich_text.map((text: any) => text.plain_text).join("");
        }
        if (block.type === "to_do" && block.to_do?.rich_text) {
          const checked = block.to_do.checked ? "[x]" : "[ ]";
          return `${checked} ${block.to_do.rich_text.map((text: any) => text.plain_text).join("")}`;
        }
        if (block.type === "code" && block.code?.rich_text) {
          return "```\n" + block.code.rich_text.map((text: any) => text.plain_text).join("") + "\n```";
        }
        return "";
      })
      .filter((text) => text.length > 0)
      .join("\n\n");

    // Extract title
    let title = "Untitled";
    if ((page as any).properties) {
      const titleProp = Object.values((page as any).properties).find(
        (prop: any) => prop.type === "title"
      ) as any;
      if (titleProp?.title?.[0]?.plain_text) {
        title = titleProp.title[0].plain_text;
      }
    }

    return {
      id: pageId,
      title,
      url: (page as any).url,
      content,
      created_time: (page as any).created_time,
      last_edited_time: (page as any).last_edited_time,
    };
  } catch (error) {
    throw new Error(
      `Failed to get Notion page: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

//Create a new Notion page
export async function createNotionPage(
  databaseId: string,
  title: string,
  content: string,
  accessToken: string
) {
  try {
    const notion = getNotionClient(accessToken);

    // Split content into chunks if it's too long (Notion has a 2000 char limit per rich_text)
    const maxChunkSize = 2000;
    const contentBlocks = [];
    
    if (content && content.trim().length > 0) {
      // Split by paragraphs first (by double newlines)
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      
      for (const paragraph of paragraphs) {
        if (paragraph.length <= maxChunkSize) {
          // Paragraph fits in one block
          contentBlocks.push({
            object: "block" as const,
            type: "paragraph" as const,
            paragraph: {
              rich_text: [
                {
                  type: "text" as const,
                  text: {
                    content: paragraph,
                  },
                },
              ],
            },
          });
        } else {
          // Split long paragraph into chunks
          for (let i = 0; i < paragraph.length; i += maxChunkSize) {
            contentBlocks.push({
              object: "block" as const,
              type: "paragraph" as const,
              paragraph: {
                rich_text: [
                  {
                    type: "text" as const,
                    text: {
                      content: paragraph.slice(i, i + maxChunkSize),
                    },
                  },
                ],
              },
            });
          }
        }
      }
    }

    // Create the page
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: contentBlocks.length > 0 ? contentBlocks : undefined,
    });

    return {
      id: response.id,
      url: "url" in response ? response.url : undefined,
      title,
      success: true,
    };
  } catch (error) {
    console.error("Notion API Error:", error);
    throw new Error(
      `Failed to create Notion page: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Append content to an existing Notion page
 */
export async function appendToNotionPage(pageId: string, content: string, accessToken: string) {
  try {
    const notion = getNotionClient(accessToken);

    // Append block to the page
    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: content,
                },
              },
            ],
          },
        },
      ],
    });

    return {
      pageId,
      success: true,
      message: "Content appended successfully",
    };
  } catch (error) {
    throw new Error(
      `Failed to append to Notion page: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * List databases accessible to the integration
 */
export async function listNotionDatabases(accessToken: string) {
  try {
    const notion = getNotionClient(accessToken);

    const response = await notion.search({
      filter: {
        property: "object",
        value: "database" as any, // Notion SDK type issue - database is valid but not in types
      },
      page_size: 20,
    });

    const databases = response.results.map((db: any) => {
      let title = "Untitled Database";
      if (db.title?.[0]?.plain_text) {
        title = db.title[0].plain_text;
      }

      return {
        id: db.id,
        title,
        url: db.url,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time,
      };
    });

    return {
      databases,
      count: databases.length,
    };
  } catch (error) {
    throw new Error(
      `Failed to list Notion databases: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
