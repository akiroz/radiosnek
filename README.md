Install
```
# dnf install -y fedora-workstation-repositories
# dnf config-manager --set-enabled google-chrome
# dnf install -y git make g++ chromedriver google-chrome-stable nodejs \
    alsa-lib alsa-lib-devel alsa-utils libsodium libtool
# echo "snd-aloop" > /etc/modules-load.d/aloop.conf
# useradd -r radiosnek -G audio
$ git clone ...
$ npm ci
```

Testing
```
$ chromium-browser --headless --remote-debugging-port=9222 ''
```
