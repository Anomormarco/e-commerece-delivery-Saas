import { disconnectPrisma } from "../../database/prisma.js";

export function startService({ app, serviceName, port, onUpgrade }) {
  const server = app.listen(port, () => {
    console.log(`${serviceName} is running on port ${port}`);
  });

  if (onUpgrade) {
    server.on("upgrade", (request, socket, head) => {
      const handled = onUpgrade(request, socket, head);
      if (!handled) socket.destroy();
    });
  }

  process.on("SIGINT", async () => {
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  });

  return server;
}
