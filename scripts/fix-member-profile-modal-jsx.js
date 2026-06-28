const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'MemberProfileModal.tsx');

function main() {
  if (!fs.existsSync(filePath)) {
    console.log(`[fix-member-profile-modal-jsx] File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const wrongBlock = `</Modal>\n\n          </View>\n        </View>\n\n        {/* ── Report Modal Overlay ── */}`;
  const rightBlock = `</Modal>\n\n        {/* ── Report Modal Overlay ── */}`;

  if (content.includes(wrongBlock)) {
    content = content.replace(wrongBlock, rightBlock);
    changed = true;
    console.log('[fix-member-profile-modal-jsx] Removed extra closing tags before report overlay.');
  }

  const wrongEnd = `        )}\n      </View>\n    </Modal>\n  );`;
  const rightEnd = `        )}\n    </>\n  );`;

  if (content.includes(wrongEnd)) {
    content = content.replace(wrongEnd, rightEnd);
    changed = true;
    console.log('[fix-member-profile-modal-jsx] Added missing fragment closing and removed extra closings at end.');
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    console.log('[fix-member-profile-modal-jsx] No changes needed.');
  }
}

main();