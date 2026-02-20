    /**
 * AWS RDS Manual Snapshot Trigger
 * Use this to create a permanent backup before making major changes.
 * Note: Requires AWS CLI configured on the server.
 */

const { exec } = require('child_process');

const INSTANCE_ID = 'database-1'; // Your AWS RDS Instance ID
const SNAPSHOT_ID = `manual-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;

console.log(`🚀 Triggering manual snapshot: ${SNAPSHOT_ID}...`);

const command = `aws rds create-db-snapshot --db-instance-identifier ${INSTANCE_ID} --db-snapshot-identifier ${SNAPSHOT_ID} --region ap-south-1`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Error triggering snapshot: ${error.message}`);
        console.log('💡 TIP: Check if AWS CLI is installed and has IAM permissions (rds:CreateDBSnapshot)');
        return;
    }
    if (stderr) {
        console.error(`⚠️ AWS CLI Warning: ${stderr}`);
    }
    console.log('✅ Snapshot request sent successfully!');
    console.log('View progress in AWS Console -> RDS -> Snapshots');
});
