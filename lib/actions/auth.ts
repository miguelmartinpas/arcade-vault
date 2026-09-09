'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Server Action para registrar un nuevo usuario.
 *
 * Flujo:
 * 1. Valida que playerName sea 1-12 caracteres
 * 2. Verifica que playerName no exista ya en players.name (unique)
 * 3. Crea usuario en Supabase Auth con email/password (Supabase envía email de verificación)
 * 4. Si signUp exitoso, inserta fila en players con user_id + name
 *
 * @returns { ok: true } si el registro fue exitoso, { ok: false, error: string } si falló
 */
export async function signUpAction(input: {
    email: string;
    password: string;
    playerName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const { email, password, playerName } = input;

    // Validar longitud del nombre de jugador
    if (!playerName || playerName.length < 1 || playerName.length > 12) {
        return { ok: false, error: 'El nombre de jugador debe tener entre 1 y 12 caracteres' };
    }

    // Validar contraseña server-side (defensa en profundidad)
    if (password.length < 8) {
        return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[@$!%*?&]/.test(password);

    if (!hasUppercase || !hasNumber || !hasSymbol) {
        return { ok: false, error: 'La contraseña debe incluir mayúscula, número y símbolo' };
    }

    const supabase = await createClient();

    // Verificar que el nombre de jugador no exista ya
    const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('name')
        .eq('name', playerName)
        .maybeSingle();

    if (checkError) {
        console.error('Error al verificar nombre de jugador:', checkError);
        return { ok: false, error: 'Error al verificar disponibilidad del nombre' };
    }

    if (existingPlayer) {
        return { ok: false, error: 'Nombre ya en uso, elige otro' };
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Error al crear usuario en Auth:', authError);

        // Mensajes de error más amigables
        if (authError.message.includes('already registered')) {
            return { ok: false, error: 'Este email ya está registrado' };
        }
        if (authError.message.includes('invalid email')) {
            return { ok: false, error: 'Email inválido' };
        }
        if (authError.message.includes('password')) {
            return { ok: false, error: 'La contraseña no cumple los requisitos mínimos' };
        }

        return { ok: false, error: authError.message || 'Error al crear la cuenta' };
    }

    if (!authData.user) {
        return { ok: false, error: 'No se pudo crear el usuario' };
    }

    // Insertar fila en players con user_id + name
    const { error: insertError } = await supabase.from('players').insert({
        user_id: authData.user.id,
        name: playerName,
    });

    if (insertError) {
        console.error('Error al crear perfil de jugador:', insertError);
        // Usuario creado en Auth pero no en players - caso edge documentado en riesgos
        return {
            ok: false,
            error: 'Error al crear el perfil de jugador. Contacta con soporte.',
        };
    }

    return { ok: true };
}

/**
 * Server Action para iniciar sesión.
 *
 * Flujo:
 * 1. Llama a supabase.auth.signInWithPassword()
 * 2. Verifica que el email esté confirmado
 *
 * @returns { ok: true } si el login fue exitoso, { ok: false, error: string } si falló
 */
export async function signInAction(input: {
    email: string;
    password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const { email, password } = input;

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Error al iniciar sesión:', error);

        // Mensajes de error más amigables
        if (error.message.includes('Invalid login credentials')) {
            return { ok: false, error: 'Email o contraseña incorrectos' };
        }
        if (error.message.includes('Email not confirmed')) {
            return { ok: false, error: 'Debes verificar tu email antes de iniciar sesión' };
        }

        return { ok: false, error: error.message || 'Error al iniciar sesión' };
    }

    // Verificar que el email esté confirmado
    if (data.user && !data.user.email_confirmed_at) {
        // Cerrar la sesión recién creada
        await supabase.auth.signOut();
        return { ok: false, error: 'Debes verificar tu email antes de iniciar sesión' };
    }

    // Revalidar rutas que dependen de la sesión
    revalidatePath('/', 'layout');

    return { ok: true };
}

/**
 * Server Action para cerrar sesión.
 */
export async function signOutAction(): Promise<{ ok: true }> {
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Revalidar rutas que dependen de la sesión
    revalidatePath('/', 'layout');

    // No redirigir aquí - dejar que el cliente maneje la navegación
    // después de que el estado de sesión se haya sincronizado
    return { ok: true };
}
