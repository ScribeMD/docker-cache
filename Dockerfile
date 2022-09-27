# for testing purposes
# checkov:skip=CKV_DOCKER_3:Suppress error "Ensure that a user for the container has been created" since this Dockerfile is only used for testing.

FROM scratch
LABEL description="empty image"
COPY LICENSE /LICENSE
