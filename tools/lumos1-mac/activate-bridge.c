#include <fcntl.h>
#include <launch.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: activate-bridge /path/to/node /path/to/rover-bridge.mjs\n");
        return EXIT_FAILURE;
    }

    int *sockets = NULL;
    size_t socket_count = 0;
    int result = launch_activate_socket("HTTP", &sockets, &socket_count);
    if (result != 0) {
        fprintf(stderr, "Could not activate the HTTP socket: %s\n", strerror(result));
        return EXIT_FAILURE;
    }
    if (socket_count != 1) {
        fprintf(stderr, "Expected one HTTP socket, received %zu\n", socket_count);
        free(sockets);
        return EXIT_FAILURE;
    }

    int socket_fd = sockets[0];
    free(sockets);
    int flags = fcntl(socket_fd, F_GETFD);
    if (flags == -1 || fcntl(socket_fd, F_SETFD, flags & ~FD_CLOEXEC) == -1) {
        perror("Could not preserve the HTTP socket for Node.js");
        return EXIT_FAILURE;
    }

    char fd_value[32];
    snprintf(fd_value, sizeof(fd_value), "%d", socket_fd);
    if (setenv("BRIDGE_LISTEN_FD", fd_value, 1) == -1) {
        perror("Could not set BRIDGE_LISTEN_FD");
        return EXIT_FAILURE;
    }
    execv(argv[1], &argv[1]);
    perror("Could not start Node.js");
    return EXIT_FAILURE;
}
