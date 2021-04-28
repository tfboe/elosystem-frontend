FROM ubuntu:20.04

# https://github.com/cmiles74/docker-vscode
# https://hub.docker.com/r/joengenduvel/docker-vscode/dockerfile

ENV DISPLAY=10.0.75.1:0.0
ARG DEBIAN_FRONTEND=noninteractive

##
## ubuntu stuff
##

RUN apt-get update \
 && apt-get install -y curl apt-transport-https libgtk2.0-0 libxss1 libasound2 xauth x11-apps dbus git gpg libx11-xcb-dev wget

RUN mkdir /var/run/dbus

##
## /ubuntu stuff
##

##
## vscodium stuff
##

RUN wget -qO - https://gitlab.com/paulcarroty/vscodium-deb-rpm-repo/-/raw/master/pub.gpg | gpg --dearmor | dd of=/etc/apt/trusted.gpg.d/vscodium.gpg \
  && echo 'deb https://paulcarroty.gitlab.io/vscodium-deb-rpm-repo/debs/ vscodium main' | tee --append /etc/apt/sources.list.d/vscodium.list \
  && apt-get update && apt-get install -y codium
   
# not sure what this does!
#RUN cp /usr/lib/x86_64-linux-gnu/libxcb.so.1 /usr/share/code/ \
#  && cp /usr/lib/x86_64-linux-gnu/libxcb.so.1.1.0 /usr/share/code/ \
#  && sed -i 's/BIG-REQUESTS/_IG-REQUESTS/' /usr/share/code/libxcb.so.1 \
#  && sed -i 's/BIG-REQUESTS/_IG-REQUESTS/' /usr/share/code/libxcb.so.1.1.0

# change user so vscodium does not run as root
ENV USER=dev
ENV GROUP=developers
RUN groupadd $GROUP
RUN useradd -m -G $GROUP $USER -s /bin/bash
USER $USER

RUN which codium

# vscodium-extensions
#RUN /usr/bin/codium --install-extension felixfbecker.php-intellisense
#RUN /usr/bin/codium --install-extension felixfbecker.php-debug

RUN /usr/bin/codium --list-extensions

USER root

##
## /vscode stuff
##

##
## javascript stuff
##

RUN apt-get update \
  && apt-get install -y nodejs npm

##
## /javascript stuff
##

RUN mkdir /userdata && chown $USER:$GROUP /userdata

WORKDIR /workspace

COPY entrypoint.bash /usr/bin/entrypoint.bash
ENTRYPOINT /bin/bash /usr/bin/entrypoint.bash
