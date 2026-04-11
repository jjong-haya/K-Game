#!/usr/bin/env bash
set -euo pipefail

if command -v dnf >/dev/null 2>&1; then
  sudo dnf update -y
  sudo dnf install -y git nginx unzip tar jq mysql
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y git nginx unzip tar jq mysql-client curl
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
else
  echo "Unsupported package manager. Install node, nginx, mysql client manually."
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws cli is not installed. Install it manually if you need CLI deploys on EC2."
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

sudo systemctl enable nginx
sudo systemctl start nginx

echo "EC2 bootstrap completed."
