const database = require('../config/database');
const bcrypt = require('bcryptjs');

class PasswordUtils {
  static async showAllExhibitorPasswords() {
    try {
      await database.connect();
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitors = await Exhibitor.findAll({
        attributes: ['id', 'name', 'email', 'password', 'company', 'status', 'metadata'],
        raw: true,
        order: [['createdAt', 'DESC']]
      });
      
      console.log('\n🔐 ALL EXHIBITOR PASSWORDS (HASHED):');
      console.log('='.repeat(120));
      
      exhibitors.forEach((exhibitor, index) => {
        console.log(`\n${index + 1}. ${exhibitor.name} (${exhibitor.email})`);
        console.log(`   Company: ${exhibitor.company}`);
        console.log(`   Status: ${exhibitor.status}`);
        console.log(`   Password Hash: ${exhibitor.password || 'NO PASSWORD'}`);
        if (exhibitor.password) {
          console.log(`   Hash Type: ${exhibitor.password.substring(0, 7)}`);
          console.log(`   Hash Length: ${exhibitor.password.length}`);
        }
        if (exhibitor.metadata?.initialPassword) {
          console.log(`   Initial Password (from metadata): ${exhibitor.metadata.initialPassword}`);
        }
      });
      
      console.log('\n📊 SUMMARY:');
      console.log(`Total Exhibitors: ${exhibitors.length}`);
      console.log(`With Password: ${exhibitors.filter(e => e.password).length}`);
      console.log(`Without Password: ${exhibitors.filter(e => !e.password).length}`);
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await database.disconnect();
    }
  }

  static async testPassword(email, testPassword) {
    try {
      await database.connect();
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findOne({
        where: { email: email.toLowerCase().trim() },
        raw: true
      });
      
      if (!exhibitor) {
        console.log(`❌ No exhibitor found with email: ${email}`);
        return;
      }
      
      console.log(`\n🔍 TESTING PASSWORD FOR: ${exhibitor.name} (${exhibitor.email})`);
      console.log('='.repeat(60));
      console.log(`Test Password: "${testPassword}"`);
      console.log(`Stored Hash: ${exhibitor.password}`);
      
      if (!exhibitor.password) {
        console.log('❌ No password hash stored');
        return;
      }
      
      const isValid = await bcrypt.compare(testPassword, exhibitor.password);
      console.log(`Password Match: ${isValid ? '✅ YES' : '❌ NO'}`);
      
      if (!isValid) {
        console.log('\n🔄 Trying common variations:');
        
        // Trim whitespace
        const trimmed = testPassword.trim();
        if (trimmed !== testPassword) {
          const trimmedValid = await bcrypt.compare(trimmed, exhibitor.password);
          console.log(`Trimmed "${trimmed}": ${trimmedValid ? '✅' : '❌'}`);
        }
        
        // Remove all spaces
        const noSpaces = testPassword.replace(/\s+/g, '');
        if (noSpaces !== testPassword) {
          const noSpacesValid = await bcrypt.compare(noSpaces, exhibitor.password);
          console.log(`No spaces "${noSpaces}": ${noSpacesValid ? '✅' : '❌'}`);
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await database.disconnect();
    }
  }

  static async resetExhibitorPassword(email, newPassword) {
    try {
      await database.connect();
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findOne({
        where: { email: email.toLowerCase().trim() }
      });
      
      if (!exhibitor) {
        console.log(`❌ No exhibitor found with email: ${email}`);
        return;
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await exhibitor.update({
        password: hashedPassword,
        metadata: {
          ...exhibitor.metadata,
          passwordResetRequired: false
        }
      });
      
      console.log(`\n✅ PASSWORD RESET FOR: ${exhibitor.name} (${exhibitor.email})`);
      console.log('='.repeat(60));
      console.log(`New Plain Password: ${newPassword}`);
      console.log(`New Hash: ${hashedPassword}`);
      console.log('='.repeat(60));
      console.log('💡 Share this new password with the exhibitor.');
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await database.disconnect();
    }
  }
}

// Command line interface
const command = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

switch(command) {
  case 'show-all':
    PasswordUtils.showAllExhibitorPasswords();
    break;
  case 'test':
    if (!email || !password) {
      console.log('Usage: node showPasswords.js test <email> <password>');
      break;
    }
    PasswordUtils.testPassword(email, password);
    break;
  case 'reset':
    if (!email || !password) {
      console.log('Usage: node showPasswords.js reset <email> <newPassword>');
      break;
    }
    PasswordUtils.resetExhibitorPassword(email, password);
    break;
  default:
    console.log('Available commands:');
    console.log('  show-all                     - Show all exhibitor password hashes');
    console.log('  test <email> <password>      - Test a password for an exhibitor');
    console.log('  reset <email> <newPassword>  - Reset exhibitor password');
    break;
}