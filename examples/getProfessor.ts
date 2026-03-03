import { RMPClient } from "ratemyprofessors-client";

async function main(): Promise<void> {
  const professorId = "PROFESSOR_ID";
  const client = new RMPClient();
  try {
    const professor = await client.getProfessor(professorId);
    console.log(professor);
  } finally {
    await client.close();
  }
}

main();
