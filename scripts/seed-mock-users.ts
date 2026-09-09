#!/usr/bin/env node
/**
 * Script para crear usuarios mock en Supabase Auth y vincularlos a la tabla players.
 *
 * Pre-requisitos:
 * - Tabla players debe tener la columna user_id agregada (migración aplicada)
 * - Variables de entorno configuradas en .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Ejecutar con: npx tsx scripts/seed-mock-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Error: faltan variables de entorno requeridas');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
    console.error('\nAsegúrate de que .env.local tenga ambas variables configuradas.');
    process.exit(1);
}

// Cliente con privilegios de admin
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

interface Player {
    id: string;
    name: string;
    user_id: string | null;
}

async function seedMockUsers() {
    console.log('🚀 Iniciando seed de usuarios mock...\n');

    // 1. Obtener jugadores que no tienen user_id todavía
    const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name, user_id')
        .is('user_id', null)
        .order('name');

    if (playersError) {
        console.error('❌ Error al obtener jugadores:', playersError.message);
        process.exit(1);
    }

    if (!players || players.length === 0) {
        console.log('✅ Todos los jugadores ya tienen user_id asignado.');
        process.exit(0);
    }

    console.log(`📋 Encontrados ${players.length} jugadores sin user_id:\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    // 2. Crear usuario en Auth para cada jugador
    for (const player of players as Player[]) {
        const email = `${player.name.toLowerCase()}@mock.com`;
        const password = 'Test-001!'; // Cumple validación: 8+ chars, mayúscula, número, símbolo

        console.log(`⏳ Procesando: ${player.name} (${email})...`);

        // Crear usuario con Admin API
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Ya verificado
        });

        if (authError) {
            // Si el usuario ya existe (por ejecución previa), intentamos obtenerlo
            if (authError.message.includes('already') || authError.message.includes('exists')) {
                console.log(`   ⚠️  Usuario ya existe, intentando obtener user_id...`);

                // Buscar usuario por email
                const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

                if (listError) {
                    console.error(`   ❌ Error al buscar usuario existente:`, listError.message);
                    failed++;
                    continue;
                }

                const existingUser = existingUsers?.users.find((u) => u.email === email);

                if (existingUser) {
                    // Actualizar players.user_id
                    const { error: updateError } = await supabase
                        .from('players')
                        .update({ user_id: existingUser.id })
                        .eq('id', player.id);

                    if (updateError) {
                        console.error(`   ❌ Error al actualizar player:`, updateError.message);
                        failed++;
                    } else {
                        console.log(`   ✓ Vinculado a usuario existente (${existingUser.id})`);
                        skipped++;
                    }
                } else {
                    console.error(`   ❌ No se pudo encontrar el usuario existente`);
                    failed++;
                }
                continue;
            }

            console.error(`   ❌ Error al crear usuario:`, authError.message);
            failed++;
            continue;
        }

        if (!authData.user) {
            console.error(`   ❌ No se recibió user_id del servidor`);
            failed++;
            continue;
        }

        // 3. Actualizar players.user_id con el ID generado
        const { error: updateError } = await supabase
            .from('players')
            .update({ user_id: authData.user.id })
            .eq('id', player.id);

        if (updateError) {
            console.error(`   ❌ Error al actualizar player:`, updateError.message);
            console.error(`   ⚠️  Usuario creado en Auth (${authData.user.id}) pero no vinculado`);
            failed++;
            continue;
        }

        console.log(`   ✅ Creado y vinculado (user_id: ${authData.user.id})`);
        created++;
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen:');
    console.log(`   ✅ Creados: ${created}`);
    console.log(`   ⚠️  Ya existían: ${skipped}`);
    console.log(`   ❌ Fallidos: ${failed}`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
        console.log('⚠️  Algunos jugadores no se pudieron procesar.');
        console.log('   Revisa los errores arriba y ejecuta el script nuevamente si es necesario.\n');
    } else {
        console.log('🎉 Seed completado exitosamente.\n');
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar
seedMockUsers().catch((error) => {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
});
