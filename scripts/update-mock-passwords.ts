#!/usr/bin/env node
/**
 * Script para actualizar las contraseñas de usuarios mock existentes en Supabase Auth.
 * Cambia todas las contraseñas de usuarios @mock.com de Test-00 a Test-001!
 *
 * Pre-requisitos:
 * - Variables de entorno configuradas en .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Ejecutar con: npx tsx scripts/update-mock-passwords.ts
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

async function updateMockPasswords() {
    console.log('🔐 Actualizando contraseñas de usuarios mock...\n');

    // 1. Listar todos los usuarios
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('❌ Error al listar usuarios:', listError.message);
        process.exit(1);
    }

    if (!usersData?.users || usersData.users.length === 0) {
        console.log('ℹ️  No hay usuarios en Supabase Auth.');
        process.exit(0);
    }

    // 2. Filtrar solo usuarios mock (@mock.com)
    const mockUsers = usersData.users.filter((u) => u.email?.endsWith('@mock.com'));

    if (mockUsers.length === 0) {
        console.log('ℹ️  No hay usuarios mock (@mock.com) para actualizar.');
        process.exit(0);
    }

    console.log(`📋 Encontrados ${mockUsers.length} usuarios mock:\n`);

    let updated = 0;
    let failed = 0;

    // 3. Actualizar contraseña de cada usuario mock
    for (const user of mockUsers) {
        console.log(`⏳ Actualizando: ${user.email}...`);

        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            password: 'Test-001!',
        });

        if (updateError) {
            console.error(`   ❌ Error:`, updateError.message);
            failed++;
            continue;
        }

        console.log(`   ✅ Contraseña actualizada a Test-001!`);
        updated++;
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 Resumen:');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ❌ Fallidos: ${failed}`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
        console.log('⚠️  Algunos usuarios no se pudieron actualizar.');
        console.log('   Revisa los errores arriba y ejecuta el script nuevamente si es necesario.\n');
    } else {
        console.log('🎉 Actualización completada exitosamente.\n');
        console.log('ℹ️  Ahora todos los usuarios mock usan la contraseña: Test-001!\n');
    }

    process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar
updateMockPasswords().catch((error) => {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
});
