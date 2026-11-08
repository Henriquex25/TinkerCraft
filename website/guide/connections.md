# Connect a project

A connection profile selects where your PHP runs. It does not create a new project or install its dependencies.

Open **New connection** from the connection controls or command palette. Give it a recognizable name, choose a mode, fill in its fields, test it, and save.

## Local directory

Choose **Local** and select the project root, such as `/home/your-user/projects/shop`. Dependencies should already be installed in that project.

## Local Docker

Choose **Docker**, find the running containers, and select the container with PHP CLI.

The project directory is **inside the container**, for example `/var/www/html`, rather than the host checkout path. Use **Detect directory** to search the container's working directory, mounts, and common locations. Review the detected directory before saving.

Your desktop user must be able to use Docker. TinkerCraft does not start containers or configure Docker permissions.

## SSH

Choose **SSH** and provide the host (or an SSH configuration alias), user, port, and identity file when needed. Enter the project directory on that server, for example `/srv/shop`.

First establish host trust from your terminal:

```bash
ssh app@server.example.com
```

Verify the server fingerprint before accepting a new host key. TinkerCraft uses non-interactive OpenSSH and keeps host-key checking enabled. Password prompts are not supported. If your private key is encrypted, make it available to the SSH agent used by the desktop session.

## Docker over SSH

Choose **SSH + Docker**, configure SSH, and select the remote PHP container. Docker access belongs to the SSH user on that server. The project path is again the path **inside the container**.

Directory detection is also available in this mode.

## Choose the bootstrap

Under **Advanced settings**:

| Bootstrap   | Behavior                                                                              |
| ----------- | ------------------------------------------------------------------------------------- |
| Automatic   | Loads Composer when available; detects Laravel from `artisan` and `bootstrap/app.php` |
| Laravel     | Initializes the Laravel console kernel                                                |
| Composer    | Loads `vendor/autoload.php`                                                           |
| Plain PHP   | Does not load the application bootstrap                                               |
| Custom file | Loads the bootstrap file you select in the execution environment                      |

**Test connection** checks the selected runtime and bootstrap. Completion setup happens separately and may take longer on the first connection. [Learn how source caching works](./autocomplete).
