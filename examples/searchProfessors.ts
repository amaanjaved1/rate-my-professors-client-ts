import { RMPClient } from "ratemyprofessors-client";

async function main(): Promise<void> {
  const client = new RMPClient();
  try {
    const result = await client.searchProfessors("Smith", { page_size: 10 });
    for (const prof of result.professors) {
      console.log(`${prof.name} (${prof.department}) - rating=${prof.overall_rating}`);
    }
  } finally {
    await client.close();
  }
}

main();
