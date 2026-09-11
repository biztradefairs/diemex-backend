const express = require('express');
const router = express.Router();
const { authenticate, authorize, authenticateExhibitor } = require('../middleware/auth');

console.log('📦 exhibitorTeamRoutes loaded');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  const modelFactory = require('../models');
  const ExhibitorTeam = modelFactory.getModel('ExhibitorTeam');
  const ExhibitorTeamMember = modelFactory.getModel('ExhibitorTeamMember');
  await ExhibitorTeam.sync();
  await ExhibitorTeamMember.sync();
  tablesReady = true;
}

function formatMember(member) {
  return {
    id: member.id,
    name: member.name,
    designation: member.designation,
    sortOrder: member.sortOrder
  };
}

function formatTeam(team) {
  if (!team) return null;
  const members = [...(team.members || [])].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );
  return {
    id: team.id,
    exhibitorId: team.exhibitorId,
    companyName: team.companyName,
    city: team.city,
    submittedAt: team.submittedAt,
    updatedAt: team.updatedAt,
    members: members.map(formatMember)
  };
}

function sanitizeMembers(rawMembers) {
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers
    .map((member, index) => ({
      name: String(member?.name || '').trim(),
      designation: String(member?.designation || '').trim(),
      sortOrder: index
    }))
    .filter((member) => member.name && member.designation);
}

router.get('/admin', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await ensureTables();
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    const ExhibitorTeam = modelFactory.getModel('ExhibitorTeam');
    const ExhibitorTeamMember = modelFactory.getModel('ExhibitorTeamMember');

    const [exhibitors, teams] = await Promise.all([
      Exhibitor.findAll({
        attributes: ['id', 'name', 'email', 'company', 'phone', 'boothNumber', 'status'],
        order: [['company', 'ASC']]
      }),
      ExhibitorTeam.findAll({
        include: [{ model: ExhibitorTeamMember, as: 'members' }]
      })
    ]);

    const teamsByExhibitor = new Map(teams.map((team) => [team.exhibitorId, team]));

    const data = exhibitors.map((exhibitor) => {
      const team = teamsByExhibitor.get(exhibitor.id);
      return {
        exhibitorId: exhibitor.id,
        exhibitorName: exhibitor.name,
        email: exhibitor.email,
        phone: exhibitor.phone || '',
        boothNumber: exhibitor.boothNumber || '',
        status: exhibitor.status,
        companyName: team?.companyName || exhibitor.company,
        city: team?.city || '',
        memberCount: team?.members?.length || 0,
        submittedAt: team?.submittedAt || null,
        hasTeam: Boolean(team)
      };
    });

    data.sort((a, b) => {
      if (a.hasTeam !== b.hasTeam) return a.hasTeam ? -1 : 1;
      return String(a.companyName || '').localeCompare(String(b.companyName || ''));
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error listing exhibitor teams:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load exhibitor teams' });
  }
});

router.get('/admin/:exhibitorId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await ensureTables();
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    const ExhibitorTeam = modelFactory.getModel('ExhibitorTeam');
    const ExhibitorTeamMember = modelFactory.getModel('ExhibitorTeamMember');

    const exhibitor = await Exhibitor.findByPk(req.params.exhibitorId, {
      attributes: ['id', 'name', 'email', 'company', 'phone', 'boothNumber', 'status']
    });

    if (!exhibitor) {
      return res.status(404).json({ success: false, error: 'Exhibitor not found' });
    }

    const team = await ExhibitorTeam.findOne({
      where: { exhibitorId: exhibitor.id },
      include: [{ model: ExhibitorTeamMember, as: 'members' }]
    });

    res.json({
      success: true,
      data: {
        exhibitor: {
          id: exhibitor.id,
          name: exhibitor.name,
          email: exhibitor.email,
          company: exhibitor.company,
          phone: exhibitor.phone || '',
          boothNumber: exhibitor.boothNumber || '',
          status: exhibitor.status
        },
        team: formatTeam(team)
      }
    });
  } catch (error) {
    console.error('Error loading exhibitor team:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load exhibitor team' });
  }
});

router.get('/', authenticateExhibitor, async (req, res) => {
  try {
    await ensureTables();
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    const ExhibitorTeam = modelFactory.getModel('ExhibitorTeam');
    const ExhibitorTeamMember = modelFactory.getModel('ExhibitorTeamMember');

    const exhibitor = await Exhibitor.findByPk(req.user.id, {
      attributes: ['id', 'company']
    });

    const team = await ExhibitorTeam.findOne({
      where: { exhibitorId: req.user.id },
      include: [{ model: ExhibitorTeamMember, as: 'members' }]
    });

    res.json({
      success: true,
      data: {
        companyName: team?.companyName || exhibitor?.company || req.user.company || '',
        city: team?.city || '',
        submittedAt: team?.submittedAt || null,
        members: formatTeam(team)?.members || []
      }
    });
  } catch (error) {
    console.error('Error loading team members:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load team members' });
  }
});

router.put('/', authenticateExhibitor, async (req, res) => {
  try {
    await ensureTables();
    const companyName = String(req.body?.companyName || '').trim();
    const city = String(req.body?.city || '').trim();
    const members = sanitizeMembers(req.body?.members);

    if (!companyName) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }
    if (!city) {
      return res.status(400).json({ success: false, error: 'City is required' });
    }
    if (!members.length) {
      return res.status(400).json({ success: false, error: 'Add at least one team member' });
    }

    const modelFactory = require('../models');
    const ExhibitorTeam = modelFactory.getModel('ExhibitorTeam');
    const ExhibitorTeamMember = modelFactory.getModel('ExhibitorTeamMember');

    let team = await ExhibitorTeam.findOne({ where: { exhibitorId: req.user.id } });

    if (team) {
      await team.update({
        companyName,
        city,
        submittedAt: new Date()
      });
    } else {
      team = await ExhibitorTeam.create({
        exhibitorId: req.user.id,
        companyName,
        city,
        submittedAt: new Date()
      });
    }

    await ExhibitorTeamMember.destroy({ where: { teamId: team.id } });
    await ExhibitorTeamMember.bulkCreate(
      members.map((member) => ({
        teamId: team.id,
        name: member.name,
        designation: member.designation,
        sortOrder: member.sortOrder
      }))
    );

    const saved = await ExhibitorTeam.findByPk(team.id, {
      include: [{ model: ExhibitorTeamMember, as: 'members' }]
    });

    res.json({
      success: true,
      message: 'Team members submitted successfully',
      data: formatTeam(saved)
    });
  } catch (error) {
    console.error('Error submitting team members:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to submit team members' });
  }
});

module.exports = router;
