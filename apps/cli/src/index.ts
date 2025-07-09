#!/usr/bin/env bun

import { Command } from 'commander';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const program = new Command();

interface ClientInfo {
  file: string;
  line: number;
  column: number;
  clientName: string;
  schemaName: string;
  entityName: string;
  backendClient: string;
}

/**
 * Parse TypeScript file and extract createClient calls
 */
function extractCreateClientCalls(filePath: string): ClientInfo[] {
  const results: ClientInfo[] = [];
  
  try {
    const sourceText = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    function visit(node: ts.Node) {
      // Look for call expressions
      if (ts.isCallExpression(node)) {
        // Check if it's a createClient call
        if (ts.isIdentifier(node.expression) && node.expression.text === 'createClient') {
          const clientInfo = parseCreateClientCall(node, sourceFile, filePath);
          if (clientInfo) {
            results.push(clientInfo);
          }
        }
      }
      
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch (error) {
    console.warn(`Warning: Could not parse ${filePath}: ${error}`);
  }

  return results;
}

/**
 * Parse a specific createClient call expression
 */
function parseCreateClientCall(
  node: ts.CallExpression, 
  sourceFile: ts.SourceFile, 
  filePath: string
): ClientInfo | null {
  try {
    const args = node.arguments;
    if (args.length < 3) return null;

    // Get position info
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Extract schema name (first argument)
    const schemaArg = args[0];
    let schemaName = 'unknown';
    if (ts.isIdentifier(schemaArg)) {
      schemaName = schemaArg.text;
    }

    // Extract entity name (second argument)
    const entityArg = args[1];
    let entityName = 'unknown';
    if (ts.isStringLiteral(entityArg)) {
      entityName = entityArg.text;
    }

    // Extract backend client (third argument)
    const clientArg = args[2];
    let backendClient = 'unknown';
    if (ts.isIdentifier(clientArg)) {
      backendClient = clientArg.text;
    }

    // Try to find the variable assignment to get client name
    let clientName = 'unknown';
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      clientName = parent.name.text;
    } else if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      clientName = parent.name.text;
    }

    return {
      file: path.relative(getProjectRoot(), filePath),
      line: line + 1,
      column: character + 1,
      clientName,
      schemaName,
      entityName,
      backendClient,
    };
  } catch (error) {
    console.warn(`Warning: Could not parse createClient call in ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Get project root directory
 */
function getProjectRoot(): string {
  return path.resolve(process.cwd(), '../..');
}

/**
 * Scan codebase for createClient instances
 */
async function scanForClients(searchPaths: string[]): Promise<ClientInfo[]> {
  const allResults: ClientInfo[] = [];
  
  for (const searchPath of searchPaths) {
    console.log(`🔍 Scanning ${path.relative(getProjectRoot(), searchPath)}...`);
    
    // Find all TypeScript files
    const files = await glob(`${searchPath}/**/*.{ts,tsx}`, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
    });

    console.log(`   Found ${files.length} TypeScript files`);

    for (const file of files) {
      const results = extractCreateClientCalls(file);
      if (results.length > 0) {
        console.log(`   ✓ Found ${results.length} clients in ${path.relative(getProjectRoot(), file)}`);
      }
      allResults.push(...results);
    }
  }

  return allResults;
}

/**
 * Format and display results
 */
function displayResults(clients: ClientInfo[]) {
  if (clients.length === 0) {
    console.log('❌ No createClient instances found.');
    return;
  }

  console.log(`\n✅ Found ${clients.length} createClient instance(s):\n`);

  clients.forEach((client, index) => {
    console.log(`${index + 1}. 📝 Client: ${client.clientName}`);
    console.log(`   📍 Location: ${client.file}:${client.line}:${client.column}`);
    console.log(`   📋 Schema: ${client.schemaName}`);
    console.log(`   🏷️  Entity: ${client.entityName}`);
    console.log(`   🔌 Backend: ${client.backendClient}`);
    console.log('');
  });

  // Summary statistics
  const uniqueSchemas = new Set(clients.map(c => c.schemaName)).size;
  const uniqueEntities = new Set(clients.map(c => c.entityName)).size;
  const uniqueBackends = new Set(clients.map(c => c.backendClient)).size;

  console.log('📊 Summary:');
  console.log(`   • ${clients.length} total client instances`);
  console.log(`   • ${uniqueSchemas} unique schemas`);
  console.log(`   • ${uniqueEntities} unique entities`);
  console.log(`   • ${uniqueBackends} unique backend clients`);
}

// CLI Command Setup
program
  .name('pi-cli')
  .description('Pi framework CLI tools')
  .version('1.0.0');

program
  .command('analyze-clients')
  .description('Analyze createClient usage across the codebase')
  .option('-p, --paths <paths...>', 'Paths to scan (default: apps, packages)', ['apps', 'packages'])
  .action(async (options) => {
    console.log('🚀 Pi CLI - Client Analysis Tool\n');
    
    // Convert relative paths to absolute paths from project root
    const projectRoot = getProjectRoot();
    const searchPaths = options.paths.map((p: string) => path.resolve(projectRoot, p));
    
    console.log(`📂 Project root: ${projectRoot}`);
    console.log(`📂 Search paths: ${searchPaths.map(p => path.relative(projectRoot, p)).join(', ')}`);
    console.log('');
    
    try {
      const clients = await scanForClients(searchPaths);
      displayResults(clients);
    } catch (error) {
      console.error('❌ Error during analysis:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();