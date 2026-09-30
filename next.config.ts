import type { NextConfig } from "next";

const config: NextConfig = {
  // next dev (16.3+) appends a managed "read the bundled docs" block to
  // CLAUDE.md whenever it runs under an AI agent. CLAUDE.md is hand-kept and
  // already says where the version-matched docs are, so the block stays off.
  agentRules: false,
};

export default config;
