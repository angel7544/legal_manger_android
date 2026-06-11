import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { getDB, closeDB, initDatabase } from '../database/db';

const DB_DIR = FileSystem.documentDirectory + 'SQLite/';
const DB_PATH = DB_DIR + 'legal_files.db';

/**
 * Triggers the backup flow by sharing the raw SQLite database file.
 * The user can save it to their device, send it via WhatsApp, email, or Google Drive.
 * 
 * @returns boolean indicating success
 */
export async function triggerBackup(): Promise<boolean> {
  try {
    // Ensure database file exists
    const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!fileInfo.exists) {
      console.warn('Database file does not exist at path:', DB_PATH);
      return false;
    }

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(DB_PATH, {
        dialogTitle: 'Nyaya Legal Files Database Backup',
        mimeType: 'application/x-sqlite3',
        UTI: 'public.database',
      });
      return true;
    } else {
      console.error('Sharing is not available on this device');
      return false;
    }
  } catch (error) {
    console.error('Error during backup:', error);
    return false;
  }
}

/**
 * Prompts the user to select a backup file (.db or .sql) and restores the database.
 * Supports direct file replacement for .db and batch query execution for .sql.
 * 
 * @returns boolean indicating success
 */
export async function triggerRestore(): Promise<boolean> {
  try {
    // Pick the backup file (.db or .sql)
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: ['application/x-sqlite3', 'text/plain', 'application/sql', '*/*'],
      copyToCacheDirectory: true,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return false;
    }

    const selectedFile = pickerResult.assets[0];
    const fileName = selectedFile.name.toLowerCase();
    const fileUri = selectedFile.uri;

    // Verify format
    const isDb = fileName.endsWith('.db') || fileName.endsWith('.sqlite');
    const isSql = fileName.endsWith('.sql');

    if (!isDb && !isSql) {
      throw new Error('Unsupported backup file format. Please select a .db or .sql file.');
    }

    // Ensure the SQLite directory exists
    const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
    }

    // Close the current DB before deleting it to release file locks
    await closeDB();
    
    if (isDb) {
      // Overwrite the database file directly
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      await FileSystem.copyAsync({
        from: fileUri,
        to: DB_PATH,
      });
      console.log('Restored DB file successfully from picker');
      // Re-initialize database connection
      await initDatabase();
    } else {
      // It is a .sql file
      // Read the SQL commands from the selected file
      const sqlContent = await FileSystem.readAsStringAsync(fileUri);

      // Clean the database by deleting the DB file
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      
      // Open a fresh SQLite connection (creates a brand new empty database)
      const freshDb = await getDB();
      
      // Disable foreign keys temporarily during restore to allow inserting tables and data in any order
      await freshDb.execAsync('PRAGMA foreign_keys = OFF;');
      
      // Execute the entire SQL script
      console.log('Executing SQL restore script...');
      await freshDb.execAsync(sqlContent);
      
      // Re-enable foreign keys after tables and records are successfully imported
      await freshDb.execAsync('PRAGMA foreign_keys = ON;');
      console.log('Restored database from SQL script successfully');
    }

    return true;
  } catch (error: any) {
    console.error('Error during restore:', error);
    throw error;
  }
}
