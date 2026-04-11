const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
        env[parts[0].trim()] = parts[1].trim();
    }
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    const { data, error } = await supabase
        .from('members')
        .update({ gender: 'Female' })
        .eq('email', 'roar4545@gmail.com');
    
    if (error) {
        console.error('Error updating gender:', error.message);
        process.exit(1);
    }
    
    const { data: verifyData } = await supabase
        .from('members')
        .select('email, gender')
        .eq('email', 'roar4545@gmail.com')
        .single();
        
    if (verifyData) {
        console.log('Successfully updated:', verifyData.email, 'Gender:', verifyData.gender);
    }
}

main();