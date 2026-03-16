import { RMPClient } from "ratemyprofessors-client";

async function main(): Promise<void> {
  const professorId = "2823076";
  const client = new RMPClient();
  try {
    const professor = await client.getProfessor(professorId);
    console.log(professor);
  } finally {
    await client.close();
  }
}

main();
