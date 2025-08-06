
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, Colors, ChannelType } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

// Load config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Store auto-NSFW channels
let autoNsfwChannels = new Set();
let autoNsfwIntervals = new Map();

// R34 Command
const r34Command = {
    data: new SlashCommandBuilder()
        .setName('r34')
        .setDescription('Search for Rule34 images.')
        .setNSFW(true)
        .addStringOption(option =>
            option.setName('tags')
                .setDescription('Search tags')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of results (up to 10)')
                .setRequired(false)
        ),
    async execute(interaction) {
        if (!interaction.channel.nsfw) {
            return await interaction.reply({ content: 'This command can only be used in NSFW channels.', ephemeral: true });
        }

        try {
            const tagsOption = interaction.options.getString('tags');
            const tagsInput = tagsOption.trim().split(',');
            const encodedTags = tagsInput.map((tag) => encodeURIComponent(tag));
            const joinedTags = encodedTags.join('%20');

            let limit = interaction.options.getInteger('limit') || 5;
            limit = Math.max(1, Math.min(10, limit));

            await interaction.deferReply({ ephemeral: false });

            const response = await axios.get(
                `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${joinedTags}`
            );

            const data = response.data;

            if (data && data.length > 0) {
                const selectedPosts = [];
                for (let i = 0; i < limit; i++) {
                    const randomIndex = Math.floor(Math.random() * data.length);
                    selectedPosts.push(data[randomIndex]);
                }

                const links = selectedPosts.map((post, index) => `[${index + 1}] ${post.file_url}`);

                await interaction.followUp({
                    content: `Search Tags: ${tagsInput.map((tag) => `\`${tag}\``)}\n\n${links.join('\n')}`,
                    ephemeral: false,
                });
            } else {
                await interaction.followUp('No results found for the provided tags.');
            }
        } catch (error) {
            console.error(error);
            await interaction.followUp('An error occurred while searching Rule34.');
        }
    }
};

// Nekobot Command
const nekobotCommand = {
    data: new SlashCommandBuilder()
        .setNSFW(true)
        .setName('nekobot')
        .setDescription('pick any porn youd like')
        .addStringOption(option => 
            option.setName("type")
                .setDescription("pick a type")
                .setRequired(true)
                .addChoices(
                    { name: "4k", value: "4k" },
                    { name: "Anal", value: "anal" },
                    { name: "Ass", value: "ass" },
                    { name: "Gone Wild", value: "gonewild" },
                    { name: "Porn Gif", value: "pgif" },
                    { name: "Pussy", value: "pussy" },
                    { name: "Thigh", value: "thigh" },
                    { name: "Boobs", value: "boobs" },
                    { name: "Hentai Ass", value: "hass" },
                    { name: "Hentai", value: "hentai" },
                    { name: "Hentai Anal", value: "hanal" },
                    { name: "Hentai Midriff", value: "hmidriff" },
                    { name: "Hentai Thigh", value: "hthigh" },
                    { name: "Hentai Boobs", value: "hboobs" },
                    { name: "Hentai Kitsune", value: "hkitsune" },
                    { name: "Tentacle", value: "tentacle" },
                    { name: "Yaoi", value: "yaoi" },
                    { name: "Hentai Solo", value: "holo" },
                    { name: "Food", value: "food" },
                )
        ),
    async execute(interaction) {
        try {
            await interaction.deferReply();

            const response = await axios.get(`https://api.waifu.pics/nsfw/waifu`);
            const imageUrl = response.data.url;

            const embed = new EmbedBuilder()
                .setTitle('NSFW Image')
                .setImage(imageUrl)
                .setColor(Colors.Red);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching NSFW content:', error);
            await interaction.editReply({ content: 'Sorry, there was an error fetching the content. Please try again later.' });
        }
    }
};

// Auto-NSFW Command
const autoNsfwCommand = {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('Configure auto-NSFW settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto-nsfw')
                .setDescription('Set a channel to automatically send NSFW content every 10 seconds')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send auto NSFW content')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        ),
    async execute(interaction) {
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await interaction.reply({ content: 'You need Manage Channels permission to use this command.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');

        if (!channel.nsfw) {
            return await interaction.reply({ content: 'The selected channel must be marked as NSFW.', ephemeral: true });
        }

        if (autoNsfwChannels.has(channel.id)) {
            // Stop auto-NSFW
            clearInterval(autoNsfwIntervals.get(channel.id));
            autoNsfwChannels.delete(channel.id);
            autoNsfwIntervals.delete(channel.id);
            
            await interaction.reply({ content: `Auto-NSFW has been disabled for ${channel}.`, ephemeral: true });
        } else {
            // Start auto-NSFW
            autoNsfwChannels.add(channel.id);
            
            const interval = setInterval(async () => {
                try {
                    const response = await axios.get(`https://api.waifu.pics/nsfw/waifu`);
                    const imageUrl = response.data.url;

                    const embed = new EmbedBuilder()
                        .setTitle('Auto NSFW')
                        .setImage(imageUrl)
                        .setColor(Colors.Red)
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                } catch (error) {
                    console.error('Error sending auto NSFW:', error);
                }
            }, 10000); // 10 seconds

            autoNsfwIntervals.set(channel.id, interval);
            
            await interaction.reply({ content: `Auto-NSFW has been enabled for ${channel}. Content will be sent every 10 seconds.`, ephemeral: true });
        }
    }
};

const commands = [r34Command, nekobotCommand, autoNsfwCommand];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Register slash commands
    try {
        console.log('Started refreshing application (/) commands.');
        
        await client.application.commands.set(commands.map(cmd => cmd.data));
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find(cmd => cmd.data.name === interaction.commandName);
    
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        const reply = { content: 'There was an error while executing this command!', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

client.login(config.token);
