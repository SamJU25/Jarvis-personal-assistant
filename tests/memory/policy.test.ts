import { describe, expect, it } from "vitest";
import { isMemoryOperationAuthorized } from "@/lib/memory/policy";

describe("Memory Authorization Policy", () => {
  describe("store_memory authorization", () => {
    it("authorizes explicit remember statements", () => {
      expect(isMemoryOperationAuthorized("Remember that I prefer concise reports.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Please remember that my video should start with the result.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Remember this: I prefer morning meetings.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Remember my preference for dark mode.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Save this as something to remember: project deadline is Nov 1.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Store this in memory: client name is ACME Corp.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Keep in mind that I am in UTC+6.", "store_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Note that I prefer markdown tables over bullet points.", "store_memory").authorized).toBe(true);
    });

    it("denies store_memory on casual conversation", () => {
      const casual1 = isMemoryOperationAuthorized("The weather is nice today.", "store_memory");
      expect(casual1.authorized).toBe(false);
      expect(casual1.reason).toContain("user did not explicitly request storing");

      const casual2 = isMemoryOperationAuthorized("The meeting today was long.", "store_memory");
      expect(casual2.authorized).toBe(false);

      const casual3 = isMemoryOperationAuthorized("I had pizza for lunch.", "store_memory");
      expect(casual3.authorized).toBe(false);

      const casual4 = isMemoryOperationAuthorized("Can you help me write an essay?", "store_memory");
      expect(casual4.authorized).toBe(false);
    });

    it("denies store_memory on inquiries about memory", () => {
      const query1 = isMemoryOperationAuthorized("What do you remember about my preferences?", "store_memory");
      expect(query1.authorized).toBe(false);
      expect(query1.reason).toContain("querying memory");

      const query2 = isMemoryOperationAuthorized("Do you remember my favorite editor?", "store_memory");
      expect(query2.authorized).toBe(false);

      const query3 = isMemoryOperationAuthorized("What are my preferences?", "store_memory");
      expect(query3.authorized).toBe(false);
    });
  });

  describe("delete_memory authorization", () => {
    it("authorizes explicit forget requests", () => {
      expect(isMemoryOperationAuthorized("Forget that I prefer concise reports.", "delete_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Please forget my video preference.", "delete_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Delete the memory about ACME Corp.", "delete_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Remove from memory: project deadline.", "delete_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Erase the memory about morning meetings.", "delete_memory").authorized).toBe(true);
    });

    it("denies delete_memory on casual conversation", () => {
      const denied = isMemoryOperationAuthorized("I forgot my keys at home today.", "delete_memory");
      expect(denied.authorized).toBe(false);
      expect(denied.reason).toContain("user did not explicitly request forgetting");
    });
  });

  describe("read-only tools authorization", () => {
    it("always permits search_memory and list_memory", () => {
      expect(isMemoryOperationAuthorized("What do I like?", "search_memory").authorized).toBe(true);
      expect(isMemoryOperationAuthorized("Show me my memories.", "list_memory").authorized).toBe(true);
    });
  });
});
