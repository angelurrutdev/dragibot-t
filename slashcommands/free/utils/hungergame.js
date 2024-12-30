const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Almacenamiento de datos
let tributos = {};
let juegoEnCurso = false;
let ronda = 0;

module.exports = {
    name: "juegosdelhambre",
    description: "Inicia o participa en Los Juegos del Hambre.",
    options: [
        {
            name: "iniciar",
            description: "Inicia los juegos (solo administradores).",
            type: 1
        }
    ],

    async execute(client, interaction) {
        if (interaction.options.getSubcommand() === "iniciar") {
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return interaction.reply({ content: "Solo los administradores pueden iniciar los juegos.", ephemeral: true });
            }
            if (juegoEnCurso) {
                return interaction.reply({ content: "¡Los juegos ya están en curso!", ephemeral: true });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('registrar_tributo')
                        .setLabel('Registrarme como Tributo')
                        .setStyle(ButtonStyle.Primary),
                );

            const embedInicio = new EmbedBuilder()
                .setColor("Orange")
                .setTitle("¡Los Juegos del Hambre están por comenzar!")
                .setDescription("Haz clic en el botón de abajo para registrarte como tributo. Tienes 60 segundos para registrarte.");

            const mensajeInicio = await interaction.reply({ embeds: [embedInicio], components: [row] });

            juegoEnCurso = true;

            const collector = mensajeInicio.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.customId === 'registrar_tributo') {
                    if (!juegoEnCurso) {
                        return i.reply({ content: "El tiempo de registro ha terminado.", ephemeral: true });
                    }
                    if (tributos[i.user.id]) {
                        return i.reply({ content: "¡Ya estás registrado como tributo!", ephemeral: true });
                    }

                    const avatarURL = i.user.displayAvatarURL({ dynamic: true, size: 1024 });
                    tributos[i.user.id] = { nombre: i.user.username, vivo: true, vida: 20, inventario: [], avatar: avatarURL };

                    const embedRegistro = new EmbedBuilder()
                        .setColor("Green")
                        .setDescription(`✅ | ${i.user.username} se ha registrado como tributo.`);
                    await i.reply({ embeds: [embedRegistro], ephemeral: true });
                }
            });

            collector.on('end', collected => {
                juegoEnCurso = false; // Mover esto aquí para evitar problemas de carrera

                if (Object.keys(tributos).length < 2) {
                    return interaction.followUp({ content: "No hay suficientes tributos para iniciar los juegos. Se necesitan al menos 2.", ephemeral: true });
                }

                ronda = 1;
                iniciarRonda(client, interaction);
            });
        }
    }
};

async function iniciarRonda(client, interaction) {
    const tributosVivos = Object.entries(tributos).filter(([, t]) => t.vivo);

    if (tributosVivos.length <= 1) {
        const ganador = tributosVivos[0]?.[1];
        juegoEnCurso = false;
        const embedGanador = new EmbedBuilder()
            .setColor("Gold")
            .setTitle("¡Los Juegos del Hambre han terminado!")
            .setDescription(`¡${ganador ? ganador.nombre : "Nadie"} ha sobrevivido y es el ganador!`);

        // Enviar el mensaje de ganador al canal *y* responder al interaction original.
        await interaction.channel.send({ embeds: [embedGanador] });
          }

    const embedRonda = new EmbedBuilder()
        .setColor("Blue")
        .setTitle(`Comienza la Ronda ${ronda}`)
        .setDescription("Los tributos se enfrentan a nuevos peligros...");
    await interaction.channel.send({ embeds: [embedRonda] });


    if (tributosVivos.length >= 2) {
        const tributo1 = tributosVivos[Math.floor(Math.random() * tributosVivos.length)];
        let tributo2;
        do {
            tributo2 = tributosVivos[Math.floor(Math.random() * tributosVivos.length)];
        } while (tributo1[0] === tributo2[0]);

        const resultado = Math.random();
        let mensajeEvento = "";
        let danio = 0;

        // Simplificar la lógica de daño y muerte
        const aplicarDanio = (tributo, cantidad) => {
            tributos[tributo[0]].vida -= cantidad;
            if (tributos[tributo[0]].vida <= 0) {
                tributos[tributo[0]].vivo = false;
                return ` ¡${tributo[1].nombre} ha muerto!`;
            }
            return "";
        };

        if (resultado < 0.15) {
            danio = Math.floor(Math.random() * 8) + 4;
            mensajeEvento = `¡${tributo1[1].nombre} tendió una emboscada y dañó a ${tributo2[1].nombre} por ${danio / 2} corazones!` + aplicarDanio(tributo2, danio);
        } else if (resultado < 0.30) {
            mensajeEvento = `¡${tributo1[1].nombre} y ${tributo2[1].nombre} se encontraron en una tregua temporal y compartieron provisiones!`;
        } else if (resultado < 0.45) {
            mensajeEvento = `¡${tributo1[1].nombre} tropezó con una trampa, pero logró escapar ileso!`;
        } else if (resultado < 0.60) {
            mensajeEvento = `¡${tributo2[1].nombre} encontró un refugio seguro para pasar la noche!`;
        } else if (resultado < 0.75) {
            danio = Math.floor(Math.random() * 4) + 2;
            mensajeEvento = `¡${tributo1[1].nombre} y ${tributo2[1].nombre} se enfrentaron en una dura batalla y ambos sufrieron ${danio / 2} corazones de daño!` + aplicarDanio(tributo1, danio) + aplicarDanio(tributo2, danio);
        } else if (resultado < 0.85) {
            tributos[tributo1[0]].vida = Math.min(tributos[tributo1[0]].vida + 4, 20);
            mensajeEvento = `¡${tributo1[1].nombre} encontró un kit de primeros auxilios! Se ha curado 2 corazones.`;
        } else {
            danio = Math.floor(Math.random() * 6) + 3;
            mensajeEvento = `¡${tributo2[1].nombre} fue atacado por un enjambre de avispas y sufrió ${danio / 2} corazones de daño!` + aplicarDanio(tributo2, danio);
        }

        const embedEvento = new EmbedBuilder()
            .setColor("Red")
            .setDescription(mensajeEvento);

        if (tributo1[1].avatar) {
            embedEvento.setThumbnail(tributo1[1].avatar);
        }
        if (tributo2 && tributo2[1].avatar) {
            embedEvento.setImage(tributo2[1].avatar);
        }

        await interaction.channel.send({ embeds: [embedEvento] });
    }

    let mensajeVidas = "**Vidas restantes al final de la ronda:**\n";
    for (const [id, tributo] of Object.entries(tributos)) {
        mensajeVidas += `${tributo.nombre}: ${tributo.vida} ❤️ ${tributo.vivo ? "" : "(Muerto)"}\n`;
    }
    const embedVidas = new EmbedBuilder()
        .setColor("Purple")
        .setDescription(mensajeVidas);
    await interaction.channel.send({ embeds: [embedVidas] });

    ronda++;
    if (tributosVivos.length > 1) {
        setTimeout(() => iniciarRonda(client, interaction), 10000);
    }
}